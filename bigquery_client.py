"""
BigQuery Client for Scoreboard Dashboard
Connects to front-data-production BigQuery project.

Primary table: analytics_raw.instructor_view
Future expansion: participant_view, check_ins_all
"""

from google.cloud import bigquery
from google.oauth2 import service_account
import json
from datetime import datetime
from typing import Optional, Dict, List, Any


class BigQueryClient:
    """Client for fetching dashboard data from BigQuery."""

    # Table configurations for easy expansion
    TABLES = {
        "instructor_view": {
            "full_name": "front-data-production.analytics_raw.instructor_view",
            "description": "Class sessions with aggregated bookings/attendees",
        },
        "participant_view": {
            "full_name": "front-data-production.analytics_raw.participant_view",
            "description": "Individual participants in each class",
        },
        "check_ins_all": {
            "full_name": "front-data-production.analytics_raw.check_ins_all",
            "description": "All facility check-ins",
        },
    }

    def __init__(self, credentials_dict: Optional[Dict] = None, credentials_path: Optional[str] = None):
        """
        Initialize BigQuery client.

        Args:
            credentials_dict: Service account credentials as dictionary (from Streamlit secrets)
            credentials_path: Path to service account JSON file (for local development)
        """
        self.client = None
        self.project_id = "front-data-production"

        if credentials_dict:
            # From Streamlit secrets (production)
            credentials = service_account.Credentials.from_service_account_info(credentials_dict)
            self.client = bigquery.Client(credentials=credentials, project=self.project_id)
        elif credentials_path:
            # From file (local development)
            credentials = service_account.Credentials.from_service_account_file(credentials_path)
            self.client = bigquery.Client(credentials=credentials, project=self.project_id)
        else:
            # Try default credentials (GCP environment)
            self.client = bigquery.Client(project=self.project_id)

    def fetch_instructor_view(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch class data from instructor_view table.
        This matches the current dashboard data structure exactly.

        Returns:
            List of records with: facility, class_name, class_date, class_end_date,
            total_bookings, total_attendees, parent_category, grandparent_category,
            greatgrandparent_category, instructor_name, instructor_id, guid, session_guid
        """
        query = f"""
        SELECT
            facility,
            class_name,
            CAST(class_date AS STRING) as class_date,
            CAST(class_end_date AS STRING) as class_end_date,
            total_bookings,
            total_attendees,
            parent_category,
            grandparent_category,
            greatgrandparent_category,
            greatgreatgrandparent_category,
            instructor_name,
            instructor_id,
            guid,
            session_guid
        FROM `{self.TABLES['instructor_view']['full_name']}`
        ORDER BY class_date DESC
        """

        if limit:
            query += f" LIMIT {limit}"

        return self._execute_query(query)

    def fetch_participant_view(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch participant data for future expansion.

        Returns:
            List of individual participant records.
        """
        query = f"""
        SELECT
            guid,
            CAST(class_date AS STRING) as class_date,
            first_name,
            last_name,
            title,
            CAST(start_time AS STRING) as start_time,
            CAST(end_time AS STRING) as end_time,
            session_guid,
            offering_id,
            final_booking_id,
            facility_id,
            parent_category,
            grandparent_category,
            greatgrandparent_category,
            greatgreatgrandparent_category,
            customer_type,
            member_type
        FROM `{self.TABLES['participant_view']['full_name']}`
        ORDER BY class_date DESC
        """

        if limit:
            query += f" LIMIT {limit}"

        return self._execute_query(query)

    def fetch_checkins(self, limit: Optional[int] = None) -> List[Dict[str, Any]]:
        """
        Fetch facility check-ins for future expansion.

        Returns:
            List of check-in records.
        """
        query = f"""
        SELECT
            customer_name,
            customer_type,
            check_in_location,
            member_home_location,
            CAST(postdate AS STRING) as postdate,
            CAST(checkin_date AS STRING) as checkin_date,
            checkin_month,
            checkin_week,
            checkin_hour,
            customer_id,
            guid,
            status,
            details,
            event_session_guid,
            event_title
        FROM `{self.TABLES['check_ins_all']['full_name']}`
        ORDER BY checkin_date DESC
        """

        if limit:
            query += f" LIMIT {limit}"

        return self._execute_query(query)

    def get_table_info(self, table_key: str) -> Dict[str, Any]:
        """Get metadata about a table."""
        if table_key not in self.TABLES:
            raise ValueError(f"Unknown table: {table_key}")

        table_ref = self.TABLES[table_key]['full_name']
        table = self.client.get_table(table_ref)

        return {
            "name": table_key,
            "full_name": table_ref,
            "description": self.TABLES[table_key]['description'],
            "num_rows": table.num_rows,
            "num_bytes": table.num_bytes,
            "modified": table.modified.isoformat() if table.modified else None,
            "schema": [{"name": f.name, "type": f.field_type} for f in table.schema]
        }

    def _execute_query(self, query: str) -> List[Dict[str, Any]]:
        """Execute a query and return results as list of dicts."""
        query_job = self.client.query(query)
        results = query_job.result()

        # Convert to list of dicts
        rows = []
        for row in results:
            row_dict = dict(row)
            # Convert any remaining special types to strings
            for key, value in row_dict.items():
                if hasattr(value, 'isoformat'):
                    row_dict[key] = value.isoformat()
            rows.append(row_dict)

        return rows

    def test_connection(self) -> Dict[str, Any]:
        """Test the BigQuery connection and return status."""
        try:
            # Simple query to test connection
            query = "SELECT 1 as test"
            result = self._execute_query(query)

            # Get row counts for main tables
            table_info = {}
            for table_key in self.TABLES:
                try:
                    info = self.get_table_info(table_key)
                    table_info[table_key] = {
                        "rows": info["num_rows"],
                        "modified": info["modified"]
                    }
                except Exception as e:
                    table_info[table_key] = {"error": str(e)}

            return {
                "status": "connected",
                "project": self.project_id,
                "tables": table_info,
                "timestamp": datetime.now().isoformat()
            }
        except Exception as e:
            return {
                "status": "error",
                "error": str(e),
                "timestamp": datetime.now().isoformat()
            }


def get_client_from_streamlit_secrets(secrets: Dict) -> BigQueryClient:
    """
    Create BigQuery client from Streamlit secrets.

    Expected secrets structure:
    [gcp_service_account]
    type = "service_account"
    project_id = "front-data-production"
    private_key_id = "..."
    private_key = "..."
    client_email = "..."
    client_id = "..."
    auth_uri = "..."
    token_uri = "..."
    ...
    """
    if "gcp_service_account" in secrets:
        credentials_dict = dict(secrets["gcp_service_account"])
        return BigQueryClient(credentials_dict=credentials_dict)
    else:
        raise ValueError("gcp_service_account not found in Streamlit secrets")


def get_client_from_file(credentials_path: str) -> BigQueryClient:
    """Create BigQuery client from credentials file (local development)."""
    return BigQueryClient(credentials_path=credentials_path)
