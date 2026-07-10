import os
import dotenv
from groq import Groq

dotenv.load_dotenv()
api_key = os.getenv("GROQ_API_KEY")
print("Using Key:", api_key)
try:
    client = Groq(api_key=api_key)
    chat_completion = client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a helpful assistant."},
            {"role": "user", "content": "Hello"}
        ],
        model="llama-3.1-8b-instant",
    )
    print("Success! Response:")
    print(chat_completion.choices[0].message.content)
except Exception as e:
    print("Error occurred:")
    print(e)
