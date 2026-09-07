import urllib.request
import re

url = 'https://app.connectmdcpay.com.br/assets/integrations-BI6Gn7iD.js'
req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
try:
    with urllib.request.urlopen(req) as resp:
        content = resp.read().decode('utf-8')
    print('Integrations length:', len(content))
    matches = re.findall(r'https?://[a-zA-Z0-9_\-\.\:/]+', content)
    print('Urls:', set(matches))
    for m in re.finditer(r'transactions|deposit|webhook|api/v1', content):
        start = max(0, m.start() - 60)
        end = min(len(content), m.end() + 100)
        print(f"Match '{m.group(0)}':", content[start:end])
except Exception as e:
    print('Error:', e)
