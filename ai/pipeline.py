def run_pipeline() -> dict[str, str]:
    return {"status": "stub"}


if __name__ == "__main__":
    assert run_pipeline()["status"] == "stub"
