with open('unbuffered_startup.log', 'r', encoding='utf-16le', errors='ignore') as f:
    err = f.read()

with open('backend_utf8.log', 'w', encoding='utf-8') as f:
    f.write(err[-5000:])
