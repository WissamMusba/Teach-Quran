from openai import OpenAI

client = OpenAI(
    base_url="https://api.tokenrouter.com/v1",
    api_key="sk-bqZqRyaQnW61qXxSev94ItfsEDZKwBtkM1ieRMM5fmYn9qk3",  # test key
)

messages = [
    {"role": "system", "content": "You are an intelligent assistant, please reply concisely."},
    {"role": "user", "content": "Hello, what kind of model are you?"},
]

response = client.chat.completions.create(
    model="qwen/qwen3.8-max-free",
    messages=messages,
    stream=False,
)

full_content = response.choices[0].message.content or ""

print(full_content)