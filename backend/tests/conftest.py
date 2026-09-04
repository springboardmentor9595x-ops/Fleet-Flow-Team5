import os
import sys
import pytest

# Ensure backend directory is in sys.path
backend_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
if backend_dir not in sys.path:
    sys.path.insert(0, backend_dir)

from clean_test_data import clean_database


@pytest.fixture(scope="session", autouse=True)
def auto_cleanup_test_data():
    yield
    # Automatically purge test users (@example.com), test shipments, and test vehicles created during test execution
    try:
        clean_database(dry_run=False)
    except Exception as e:
        print(f"\n[Teardown Notice] Auto-cleanup exception: {e}")
