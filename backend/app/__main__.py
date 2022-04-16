import uvicorn
from fastapi import FastAPI

from .config import Settings
from .routes import router


def main():
    settings = Settings()
    app = FastAPI()

    app.include_router(router)

    uvicorn.run(app, host=settings.host, port=settings.port)  # noqa


if __name__ == '__main__':
    main()
