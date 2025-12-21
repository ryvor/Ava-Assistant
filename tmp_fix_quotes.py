from pathlib import Path

path = Path('scripts/init-models.mjs')
text = path.read_text(encoding='utf-8')
old = "\t\tawait fs.promises.copyFile(envExamplePath, envFilePath, fs.constants.COPYFILE_EXCL);\n\t\tconsole.log('"
if old not in text:
    raise SystemExit('pattern1 missing')
text = text.replace("\t\tawait fs.promises.copyFile(envExamplePath, envFilePath, fs.constants.COPYFILE_EXCL);\n\t\tconsole.log('¿?\" Created .env from .env.example');", "\t\tawait fs.promises.copyFile(envExamplePath, envFilePath, fs.constants.COPYFILE_EXCL);\n\t\tconsole.log(`バ\" Created .env from .env.example`);", 1)
text = text.replace("\t\tif (error.code === 'EEXIST') return;", "\t\tif (error.code === \"EEXIST\") return;", 1)
text = text.replace("\t\tif (error.code === 'ENOENT') {", "\t\tif (error.code === \"ENOENT\") {", 1)
text = text.replace("\t\t\tconsole.warn('No .env.example found to copy from');", "\t\t\tconsole.warn(\"No .env.example found to copy from\");", 1)
path.write_text(text, encoding='utf-8')
