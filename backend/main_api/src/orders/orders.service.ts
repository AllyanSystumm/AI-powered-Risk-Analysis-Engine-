import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { HttpService } from '@nestjs/axios';
import { lastValueFrom } from 'rxjs';

@Injectable()
export class OrdersService {
    private readonly logger = new Logger(OrdersService.name);

    constructor(
        private prisma: PrismaService,
        private httpService: HttpService,
    ) { }

    // Build historical context from database for AI enrichment
    private async buildHistoricalContext(orderPayload: any) {
        const now = new Date();
        const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

        const email = orderPayload.user_profile.email;
        const userId = orderPayload.user_profile.user_id;
        const fullName = (orderPayload.user_profile.full_name || '').trim();
        const phone = orderPayload.user_profile.phone;

        // 1. Past orders by the same email (primary identifier for "same person")
        const allMatchingProfiles = await this.prisma.userProfile.findMany({
            where: { email: email },
            include: {
                orders: {
                    include: { address: true },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        const allPastOrders = allMatchingProfiles.flatMap(p => p.orders);
        const ordersLast24h = allPastOrders.filter(o => new Date(o.createdAt) >= oneDayAgo).length;
        const ordersLast7d = allPastOrders.filter(o => new Date(o.createdAt) >= sevenDaysAgo).length;

        // HURRY ORDER BOOKING: compute time since last order by this email
        let minutesSinceLastOrder: number | null = null;
        let lastOrderTimestamp: string | null = null;
        if (allPastOrders.length > 0) {
            const lastOrder = allPastOrders[0]; // already sorted desc
            lastOrderTimestamp = lastOrder.createdAt.toISOString();
            const diffMs = now.getTime() - new Date(lastOrder.createdAt).getTime();
            minutesSinceLastOrder = Math.round(diffMs / 60000);
        }

        // 2. Other customers at the same delivery address (different email)
        const matchingAddresses = await this.prisma.address.findMany({
            where: {
                street: orderPayload.address.street,
                city: orderPayload.address.city,
                postalCode: orderPayload.address.postal_code,
            },
            include: {
                orders: {
                    include: { userProfile: true }
                }
            }
        });
        const otherNamesAtAddress: string[] = [];
        for (const addr of matchingAddresses) {
            for (const order of addr.orders) {
                if (order.userProfile?.email && order.userProfile.email !== email) {
                    const entry = `${order.userProfile.fullName} (${order.userProfile.email})`;
                    if (!otherNamesAtAddress.includes(entry)) {
                        otherNamesAtAddress.push(entry);
                    }
                }
            }
        }

        // 3. DUPLICATE EMAIL — same email used by a DIFFERENT name in DB
        const duplicateEmailProfiles = await this.prisma.userProfile.findMany({
            where: {
                email: email,
                NOT: { userId: userId }
            },
        });
        const duplicateEmailMatches = duplicateEmailProfiles
            .filter(p => p.fullName.trim().toLowerCase() !== fullName.toLowerCase())
            .map(p => ({
                name: p.fullName,
                email: p.email,
                phone: p.phone,
            }));

        // 4. DUPLICATE PHONE — same phone used by a DIFFERENT name in DB
        const duplicatePhoneProfiles = await this.prisma.userProfile.findMany({
            where: {
                phone: phone,
                NOT: { email: email }
            }
        });
        const duplicatePhoneMatches = duplicatePhoneProfiles
            .filter(p => p.fullName.trim().toLowerCase() !== fullName.toLowerCase())
            .map(p => ({
                name: p.fullName,
                email: p.email,
                phone: p.phone,
            }));

        return {
            same_person_orders: {
                email: email,
                full_name: fullName,
                orders_last_24h: ordersLast24h,
                orders_last_7d: ordersLast7d,
                total_past_orders: allPastOrders.length,
                last_order_timestamp: lastOrderTimestamp,
                minutes_since_last_order: minutesSinceLastOrder,
            },
            address_history: {
                other_names_at_this_address: otherNamesAtAddress,
            },
            duplicate_email_matches: duplicateEmailMatches,
            duplicate_phone_matches: duplicatePhoneMatches,
        };
    }

    async processIncomingOrder(orderPayload: any) {
        try {
            // 1. Build historical context from database
            const historicalContext = await this.buildHistoricalContext(orderPayload);
            this.logger.log(`Historical context built: ${JSON.stringify(historicalContext)}`);

            // 2. Enrich payload with historical context and send to AI Service
            const enrichedPayload = { ...orderPayload, historical_context: historicalContext };
            const aiResponse = await lastValueFrom(
                this.httpService.post('http://localhost:8000/api/v1/analyze', enrichedPayload)
            );

            let riskData = aiResponse.data;
            if (typeof riskData === 'string') {
                try {
                    // Remove markdown wrapping if present
                    let cleanedData = riskData.replace(/```json\n?/g, '').replace(/```/g, '').trim();
                    riskData = JSON.parse(cleanedData);
                } catch (e) {
                    this.logger.error(`Failed to parse AI response: ${riskData}`);
                    throw new Error('Invalid JSON response from AI service');
                }
            }

            this.logger.log(`Received risk assessment for order ${riskData.order_id}: Score ${riskData.risk_score} -> ${riskData.recommended_action}`);

            // 3. Save everything to Database
            // Create user profile if doesn't exist
            let userProfile = await this.prisma.userProfile.findFirst({
                where: { userId: orderPayload.user_profile.user_id }
            });

            if (!userProfile) {
                userProfile = await this.prisma.userProfile.create({
                    data: {
                        userId: orderPayload.user_profile.user_id,
                        fullName: orderPayload.user_profile.full_name || '',
                        email: orderPayload.user_profile.email,
                        phone: orderPayload.user_profile.phone,
                        country: orderPayload.user_profile.country,
                        createdAt: new Date(orderPayload.user_profile.created_at)
                    }
                });
            }

            // Create Address
            const address = await this.prisma.address.create({
                data: {
                    street: orderPayload.address.street,
                    city: orderPayload.address.city,
                    state: orderPayload.address.state,
                    postalCode: orderPayload.address.postal_code,
                    country: orderPayload.address.country,
                }
            });

            // Create IP Info
            const ipInfo = await this.prisma.ipInfo.create({
                data: {
                    ipAddress: orderPayload.ip_info.ip_address,
                    ipCountry: orderPayload.ip_info.ip_country,
                    ipRegion: orderPayload.ip_info.ip_region,
                    ipCity: orderPayload.ip_info.ip_city,
                    latitude: orderPayload.ip_info.latitude,
                    longitude: orderPayload.ip_info.longitude,
                }
            });

            // Create Order
            const order = await this.prisma.order.create({
                data: {
                    orderIdString: orderPayload.order_details.order_id,
                    totalAmount: orderPayload.order_details.total_amount,
                    itemCount: orderPayload.order_details.item_count,
                    method: orderPayload.order_details.method,
                    createdAt: new Date(),
                    userProfileId: userProfile.id,
                    addressId: address.id,
                    ipInfoId: ipInfo.id,
                }
            });

            // AUTHORITATIVE RISK SCORE — computed server-side from triggered flags
            // This ensures the score is always correct, even if the LLM miscalculates.
            const ruleWeights: Record<number, number> = {
                1: 0,   // Specific Email and Phone (passed check)
                2: 0,   // Delivery City Verification (passed check)
                3: 5,   // Hurry Order Booking
                4: 5,   // Different Name with Same Address
                5: 5,   // Postal Code Validation
                6: 5,   // Duplicate Email — Different Identity
                7: 5,   // Duplicate Phone — Different Identity
                8: 5,   // City Name Mismatch
                9: 5,   // Phone Number VS Country Name
                10: 5,  // Delivery Address Details (Geocoding)
            };

            const computedScore = (riskData.risk_flags as any[])
                .filter(f => f.triggered === true)
                .reduce((sum, f) => sum + (ruleWeights[f.rule_id] ?? 0), 0);

            const llmScore = riskData.risk_score;
            if (computedScore !== llmScore) {
                this.logger.warn(
                    `LLM risk_score=${llmScore} differs from computed score=${computedScore}. Saving computed score.`
                );
            }

            const riskScore = Math.min(computedScore, 40);
            let enforcedAction: string;
            if (riskScore >= 1) {
                enforcedAction = 'manual_review';
            } else {
                enforcedAction = 'ship';
            }

            // Sync AI Summary numerical score with our computed and capped score
            let syncedSummary = riskData.summary || "No summary provided.";
            // Regex to replace numbers directly following "risk score of " or "risk score is "
            syncedSummary = syncedSummary.replace(/risk score of \d+/gi, `risk score of ${riskScore}`);
            syncedSummary = syncedSummary.replace(/risk score is \d+/gi, `risk score is ${riskScore}`);

            // Fallback: If it didn't specifically say "risk score of X", just prepend the real score to avoid confusion
            if (!syncedSummary.includes(`score of ${riskScore}`) && !syncedSummary.includes(`score is ${riskScore}`)) {
                syncedSummary = `(Score: ${riskScore}/40) ${syncedSummary}`;
            }

            // Create Risk Assessment with enforced action and synced summary
            const riskAssessment = await this.prisma.riskAssessment.create({
                data: {
                    orderId: order.id,
                    riskScore: riskScore,
                    recommendedAction: enforcedAction,
                    verificationSuggestions: riskData.verification_suggestions || [],
                    summary: syncedSummary,
                }
            });


            // Create Risk Flags
            for (const flag of riskData.risk_flags) {
                await this.prisma.riskFlag.create({
                    data: {
                        riskAssessmentId: riskAssessment.id,
                        ruleId: flag.rule_id,
                        ruleName: flag.rule_name,
                        triggered: flag.triggered,
                        confidence: parseFloat(flag.confidence),
                        explanation: flag.explanation
                    }
                });
            }

            return {
                success: true,
                orderId: order.id,
                riskScore: riskScore,
                action: enforcedAction
            };

        } catch (error) {
            this.logger.error(`Error processing order: ${error.message}`);
            throw error;
        }
    }

    async getAllOrders() {
        return this.prisma.order.findMany({
            include: {
                riskAssessment: {
                    include: {
                        riskFlags: true
                    }
                },
                userProfile: true,
                address: true
            },
            orderBy: {
                createdAt: 'asc'
            }
        });
    }

    async deleteOrder(id: string) {
        return this.prisma.order.delete({
            where: { id }
        });
    }

    async getCustomerOrderHistory(email: string) {
        // Find all user profiles with this email
        const profiles = await this.prisma.userProfile.findMany({
            where: { email: email },
            include: {
                orders: {
                    include: {
                        address: true,
                        riskAssessment: {
                            include: { riskFlags: true }
                        }
                    },
                    orderBy: { createdAt: 'desc' }
                }
            }
        });

        // Flatten all orders across all profiles with this email
        const allOrders = profiles.flatMap(p => p.orders);

        // Sort by creation date, newest first
        allOrders.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

        return {
            email,
            totalOrders: allOrders.length,
            totalSpent: allOrders.reduce((sum, o) => sum + o.totalAmount, 0),
            orders: allOrders
        };
    }
}
