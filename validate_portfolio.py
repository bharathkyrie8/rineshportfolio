import pathlib
import subprocess
from html.parser import HTMLParser

class MyParser(HTMLParser):
    def __init__(self):
        super().__init__()
        self.errors = []

    def error(self, message):
        self.errors.append(message)

root = pathlib.Path(__file__).parent
html_files = ['index.html', 'works.html']
js_files = sorted((root / 'assets' / 'js').glob('*.js')) if (root / 'assets' / 'js').exists() else []

print('=== HTML VALIDATION ===')
for fname in html_files:
    path = root / fname
    print(f'FILE: {fname} exists={path.exists()}')
    if path.exists():
        text = path.read_text(encoding='utf-8')
        parser = MyParser()
        parser.feed(text)
        parser.close()
        print(f'  parse errors: {len(parser.errors)}')
        for err in parser.errors[:5]:
            print('   ', err)

print('\n=== JS SYNTAX CHECK ===')
if not js_files:
    print('No JS directory found')
for js in js_files:
    print(f'JS: {js.name}')
    try:
        res = subprocess.run(['node', '--check', str(js)], capture_output=True, text=True, check=True)
        print('  OK')
    except subprocess.CalledProcessError as exc:
        print('  ERROR')
        print(exc.stderr)

print('\n=== FILE COUNTS ===')
print('HTML files:', len([f for f in html_files if (root / f).exists()]))
print('JS files:', len(js_files))
