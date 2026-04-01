import os
import sys

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.abspath(os.path.join(BASE_DIR, "..", ".."))
sys.path.append(PROJECT_ROOT)

from app import create_app
import app.routes as routes

app = create_app()

def main():
    token = "dev-token"

    # inject token dummy agar lolos @require_auth
    routes.ACTIVE_TOKENS[token] = {
        "email": "dev@padis.local",
        "name": "Dev User",
    }

    with app.test_request_context(
        "/api/generate-report?hazard=multi&scenario=rp25&climate=nonclimate",
        headers={"Authorization": f"Bearer {token}"},
    ):
        response = routes.generate_report()

        # send_file biasanya direct passthrough
        response.direct_passthrough = False

        output_path = os.path.join(PROJECT_ROOT, "test_report.pdf")
        with open(output_path, "wb") as f:
            f.write(response.get_data())

        print(f"PDF generated: {output_path}")

if __name__ == "__main__":
    main()