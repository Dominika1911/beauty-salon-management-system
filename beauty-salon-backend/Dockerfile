FROM python:3.11-slim
WORKDIR /app

RUN apt-get update && apt-get install -y libatomic1 && rm -rf /var/lib/apt/lists/*

# Instalacja zależności
COPY requirements.txt /app/
RUN pip install --no-cache-dir -r requirements.txt

# Skopiowanie całego kodu projektu
COPY . /app/

ENV PYTHONUNBUFFERED 1
# Polecenie, które uruchomi serwer deweloperski
CMD ["python", "manage.py", "runserver", "0.0.0.0:8000"]