FROM python:3.12-slim
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
RUN mkdir -p /app/data/uploads
ENV RP_DATABASE=/app/data/rp_phone.db RP_UPLOADS=/app/data/uploads PORT=8000
EXPOSE 8000
CMD ["python", "server.py"]
