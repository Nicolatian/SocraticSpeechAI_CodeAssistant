import json
import math
import os
import re
import sqlite3
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit
from database import (
    get_run_count,
    init_db,
    log_conversation,
    log_event,
    log_login,
    run_code,
)

from prompt import ask, ask_stream

MAX_LOG_REQUEST_SIZE = 16_384

HOST = "127.0.0.1"
PORT = int(os.environ.get("PROMPT_API_PORT", "8001"))
MAX_REQUEST_SIZE = 65_536
MAX_CODE_CHARACTERS = 20_000
MAX_EXERCISE_CONTEXT_CHARACTERS = 12_000
MAX_EXERCISE_ID_CHARACTERS = 80
MAX_HISTORY_MESSAGES = 12
MAX_HISTORY_CHARACTERS = 8_000


class PromptRequestHandler(BaseHTTPRequestHandler):
    protocol_version = "HTTP/1.1"

    def _send_json(self, status, payload):
        body = json.dumps(payload).encode("utf-8")
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        if self.path == "/favicon.ico":
            self.send_response(204)
            self.end_headers()
            return

        parsed_path = urlsplit(self.path)
        if parsed_path.path == "/api/run-count":
            self._handle_run_count(parsed_path.query)
            return

        if parsed_path.path in {"/", "/api/health"}:
            self._send_json(200, {
                "service": "Prompt API",
                "status": "ok",
                "message": "Open the Vite app to use the website.",
            })
            return

        self._send_json(404, {"error": "Not found."})

    def _read_log_payload(self, max_size=MAX_LOG_REQUEST_SIZE):
        """Read and validate a small JSON logging request."""
        try:
            content_length = int(
                self.headers.get("Content-Length", "0")
            )
        except ValueError:
            self._send_json(400, {"error": "Invalid request."})
            return None

        if content_length <= 0 or content_length > max_size:
            self._send_json(400, {"error": "Invalid request size."})
            return None

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Invalid JSON."})
            return None

        if not isinstance(payload, dict):
            self._send_json(400, {"error": "Invalid JSON object."})
            return None

        return payload

    def _handle_run_count(self, query):
        user_ids = parse_qs(query).get("userId", [])
        if (
            len(user_ids) != 1
            or not user_ids[0].strip()
            or len(user_ids[0]) > 80
        ):
            self._send_json(400, {"error": "Invalid User ID."})
            return

        try:
            run_count = get_run_count(user_ids[0].strip())
        except sqlite3.Error:
            self.log_error("Could not retrieve participant run count.")
            self._send_json(500, {"error": "Could not retrieve run count."})
            return

        if run_count is None:
            self._send_json(404, {"error": "User not found."})
            return

        self._send_json(200, {"runCount": run_count})

    def _handle_run_code(self):
        payload = self._read_log_payload(MAX_REQUEST_SIZE)
        if payload is None:
            return

        user_id = payload.get("userId")
        code = payload.get("code")
        exercise_id = payload.get("exerciseId")
        code_works = payload.get("codeWorks")
        duration_seconds = payload.get("durationSeconds")
        if (
            not isinstance(user_id, str)
            or not user_id.strip()
            or len(user_id) > 80
            or not isinstance(code, str)
            or len(code) > MAX_CODE_CHARACTERS
            or not isinstance(code_works, bool)
            or isinstance(duration_seconds, bool)
            or not isinstance(duration_seconds, (int, float))
            or not math.isfinite(duration_seconds)
            or duration_seconds < 0
        ):
            self._send_json(400, {"error": "Invalid code run completion information."})
            return
        if exercise_id is not None and (
            not isinstance(exercise_id, str)
            or len(exercise_id) > MAX_EXERCISE_ID_CHARACTERS
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", exercise_id)
        ):
            self._send_json(400, {"error": "Invalid exercise ID."})
            return

        try:
            run_number = run_code(
                user_id.strip(), code, exercise_id, code_works, duration_seconds
            )
        except (sqlite3.Error, TypeError, ValueError):
            self.log_error("Could not save participant code run.")
            self._send_json(500, {"error": "Could not save code run."})
            return

        if run_number is None:
            self._send_json(404, {"error": "User not found."})
            return

        self._send_json(200, {"success": True, "runNumber": run_number})

    def _handle_log_login(self):
        payload = self._read_log_payload()
        if payload is None:
            return

        user_id = payload.get("userId")

        if not isinstance(user_id, str) or not user_id.strip() or len(user_id) > 80:
            self._send_json(400, {"error": "Invalid User ID."})
            return

        try:
            log_login(user_id.strip())
        except sqlite3.Error:
            self.log_error("Could not save participant login.")
            self._send_json(500, {"error": "Could not save login."})
            return

        self._send_json(200, {
            "success": True,
            "userId": user_id.strip()
        })

    def _handle_log_event(self):
        payload = self._read_log_payload()
        if payload is None:
            return

        user_id = payload.get("userId")
        event_type = payload.get("eventType")
        details = payload.get("details", {})

        if (
            not isinstance(user_id, str)
            or not user_id.strip()
            or len(user_id) > 80
            or not isinstance(event_type, str)
            or not event_type.strip()
            or len(event_type) > 80
            or not isinstance(details, dict)
        ):
            self._send_json(400, {"error": "Invalid event information."})
            return

        try:
            saved = log_event(
                user_id.strip(),
                event_type.strip(),
                details
            )
        except (sqlite3.Error, TypeError, ValueError):
            self.log_error("Could not save participant event.")
            self._send_json(500, {"error": "Could not save event."})
            return

        if not saved:
            self._send_json(404, {"error": "User not found."})
            return

        self._send_json(200, {"success": True})


    
    def do_POST(self):
        if self.path == "/api/log-login":
            self._handle_log_login()
            return

        if self.path == "/api/run-code":
            self._handle_run_code()
            return

        if self.path == "/api/log-event":
            self._handle_log_event()
            return

        if self.path not in {"/api/ask", "/api/ask/stream"}:
            self._send_json(404, {"error": "Not found."})
            return

        try:
            content_length = int(self.headers.get("Content-Length", "0"))
        except ValueError:
            self._send_json(400, {"error": "Invalid Content-Length header."})
            return

        if content_length < 0:
            self._send_json(400, {"error": "Invalid Content-Length header."})
            return

        if content_length > MAX_REQUEST_SIZE:
            self._send_json(413, {"error": "Request is too large."})
            return

        try:
            payload = json.loads(self.rfile.read(content_length))
        except (json.JSONDecodeError, UnicodeDecodeError):
            self._send_json(400, {"error": "Request body must be valid JSON."})
            return

        question = payload.get("question") if isinstance(payload, dict) else None
        if not isinstance(question, str) or not question.strip():
            self._send_json(400, {"error": "Please provide a question."})
            return

        code = payload.get("code", "") if isinstance(payload, dict) else ""
        if not isinstance(code, str):
            self._send_json(400, {"error": "Code must be a string."})
            return
        if len(code) > MAX_CODE_CHARACTERS:
            self._send_json(
                413,
                {"error": f"Code must be {MAX_CODE_CHARACTERS:,} characters or fewer."},
            )
            return

        previous_code = payload.get("previousCode", "") if isinstance(payload, dict) else ""
        if not isinstance(previous_code, str):
            self._send_json(400, {"error": "Previous code must be a string."})
            return
        if len(previous_code) > MAX_CODE_CHARACTERS:
            self._send_json(
                413,
                {"error": f"Previous code must be {MAX_CODE_CHARACTERS:,} characters or fewer."},
            )
            return

        exercise_context = (
            payload.get("exerciseContext", "") if isinstance(payload, dict) else ""
        )
        if not isinstance(exercise_context, str):
            self._send_json(400, {"error": "Exercise context must be a string."})
            return
        if len(exercise_context) > MAX_EXERCISE_CONTEXT_CHARACTERS:
            self._send_json(
                413,
                {
                    "error": (
                        "Exercise context must be "
                        f"{MAX_EXERCISE_CONTEXT_CHARACTERS:,} characters or fewer."
                    )
                },
            )
            return

        user_id = payload.get("userId") if isinstance(payload, dict) else None
        if user_id is not None and (
            not isinstance(user_id, str) or not user_id.strip() or len(user_id) > 80
        ):
            self._send_json(400, {"error": "Invalid User ID."})
            return
        user_id = user_id.strip() if isinstance(user_id, str) else None

        exercise_id = payload.get("exerciseId") if isinstance(payload, dict) else None
        if exercise_id is not None and (
            not isinstance(exercise_id, str)
            or len(exercise_id) > MAX_EXERCISE_ID_CHARACTERS
            or not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", exercise_id)
        ):
            self._send_json(400, {"error": "Invalid exercise ID."})
            return

        history = payload.get("history", []) if isinstance(payload, dict) else []
        if not isinstance(history, list) or len(history) > MAX_HISTORY_MESSAGES:
            self._send_json(
                400,
                {"error": f"History must contain {MAX_HISTORY_MESSAGES} messages or fewer."},
            )
            return

        history_characters = 0
        for message in history:
            if (
                not isinstance(message, dict)
                or message.get("role") not in {"user", "assistant"}
                or not isinstance(message.get("content"), str)
            ):
                self._send_json(
                    400,
                    {"error": "History messages must have a user or assistant role and string content."},
                )
                return
            history_characters += len(message["content"])

        if history_characters > MAX_HISTORY_CHARACTERS:
            self._send_json(
                413,
                {"error": f"History must be {MAX_HISTORY_CHARACTERS:,} characters or fewer."},
            )
            return

        if self.path == "/api/ask/stream":
            self._handle_streamed_ask(
                question.strip(), code, history, exercise_context, previous_code,
                user_id, exercise_id
            )
            return

        try:
            answer = ask(question.strip(), code, history, exercise_context, previous_code)
        except RuntimeError as error:
            self._send_json(502, {"error": str(error)})
            return

        if user_id is not None:
            try:
                saved = log_conversation(
                    user_id, question.strip(), answer, exercise_id
                )
            except sqlite3.Error:
                self.log_error("Could not save Pear Programmer conversation.")
                self._send_json(500, {"error": "Could not save conversation."})
                return
            if not saved:
                self._send_json(404, {"error": "User not found; conversation was not saved."})
                return

        self._send_json(
            200,
            {"answer": answer, "codeCharacters": len(code)},
        )

    def _handle_streamed_ask(
        self, question, code, history, exercise_context, previous_code, user_id,
        exercise_id
    ):
        try:
            tokens = ask_stream(
                question, code, history, exercise_context, previous_code
            )
        except RuntimeError as error:
            self._send_json(502, {"error": str(error)})
            return

        self.send_response(200)
        self.send_header("Content-Type", "text/event-stream; charset=utf-8")
        self.send_header("Cache-Control", "no-cache")
        self.send_header("X-Accel-Buffering", "no")
        self.send_header("Transfer-Encoding", "chunked")
        self.send_header("X-Code-Characters", str(len(code)))
        self.end_headers()

        def send_event(payload):
            body = f"data: {json.dumps(payload, ensure_ascii=False)}\n\n".encode("utf-8")
            self.wfile.write(f"{len(body):X}\r\n".encode("ascii") + body + b"\r\n")
            self.wfile.flush()

        try:
            answer_parts = []
            for token in tokens:
                answer_parts.append(token)
                send_event({"token": token})
            if user_id is not None:
                try:
                    saved = log_conversation(
                        user_id, question, "".join(answer_parts), exercise_id
                    )
                except sqlite3.Error:
                    self.log_error("Could not save Pear Programmer conversation.")
                    send_event({
                        "warning": "The answer was generated but could not be saved."
                    })
                else:
                    if not saved:
                        send_event({
                            "warning": "The answer was generated but the user was not found, so it was not saved."
                        })
            send_event({"done": True})
        except RuntimeError as error:
            try:
                send_event({"error": str(error)})
            except (BrokenPipeError, ConnectionResetError):
                return
        except (BrokenPipeError, ConnectionResetError):
            return
        finally:
            try:
                self.wfile.write(b"0\r\n\r\n")
                self.wfile.flush()
            except (BrokenPipeError, ConnectionResetError):
                self.close_connection = True

def main():
    init_db()
    server = ThreadingHTTPServer((HOST, PORT), PromptRequestHandler)
    print(f"Prompt API listening on http://{HOST}:{PORT}", flush=True)
    server.serve_forever()


if __name__ == "__main__":
    main()
