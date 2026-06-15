.PHONY: dev api web install

dev:
	@trap 'kill 0' INT; \
	(cd trialfield_api && ../.venv/bin/uvicorn trialfield_api.main:app --reload --port 8000) & \
	(cd trialfield_app && npm run dev -- --port 3000) & \
	wait

api:
	cd trialfield_api && ../.venv/bin/uvicorn trialfield_api.main:app --reload --port 8000

web:
	cd trialfield_app && npm run dev -- --port 3000

install:
	pip install -e ".[dev]" && \
	pip install fastapi "uvicorn[standard]" python-multipart && \
	cd trialfield_app && npm install
