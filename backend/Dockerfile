FROM python:3.7

WORKDIR /usr/src/app/

RUN pip install poetry

ADD poetry.lock /usr/src/app/
ADD pyproject.toml /usr/src/app/
RUN poetry config virtualenvs.create false
RUN poetry install --no-interaction --no-dev

ADD ./app/ml/mobilenetv2_140_best.ckpt /usr/src/app/ml
ADD . /usr/src/app/

CMD ["python", "-m", "app"]
