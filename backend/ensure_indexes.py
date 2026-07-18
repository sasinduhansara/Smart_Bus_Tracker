from pprint import pprint

from utils.database_indexes import ensure_safe_indexes


if __name__ == "__main__":
    pprint(ensure_safe_indexes())
