import os
import json
from groq import Groq
from dotenv import load_dotenv

load_dotenv()

client = Groq(api_key=os.getenv("GROQ_API_KEY"))

try:
    completion = client.chat.completions.create(
        model="llama-3.1-8b-instant",
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello! Reply with OK"}
        ],
        temperature=0
    )
    print("SUCCESS: " + completion.choices[0].message.content)
except Exception as e:
    print("ERROR: " + str(e))
