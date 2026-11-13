"""Redis keys of the OCR pipeline (docs/stack-technique.md §8).

They are the contract between the producer (the API) and the worker: fixed names,
not configuration.
"""

# Jobs waiting for a worker, oldest at the tail.
PENDING_QUEUE_KEY = "queue:ocr:pending"
# Jobs taken by the worker and not finished yet.
PROCESSING_QUEUE_KEY = "queue:ocr:processing"


def status_key(job_id: str) -> str:
    return f"task:ocr:{job_id}:status"


def attempts_key(job_id: str) -> str:
    return f"task:ocr:{job_id}:attempts"


def result_key(job_id: str) -> str:
    return f"result:ocr:{job_id}"
