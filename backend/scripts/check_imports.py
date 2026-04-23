import pkgutil
import importlib
import backend

errors = []

for module in pkgutil.walk_packages(backend.__path__, backend.__name__ + "."):
    name = module.name
    try:
        importlib.import_module(name)
        print(f"[OK] {name}")
    except Exception as e:
        print(f"[ERROR] {name} -> {e}")
        errors.append((name, str(e)))

print("\n=== SUMMARY ===")
for err in errors:
    print(err)

if errors:
    exit(1)
