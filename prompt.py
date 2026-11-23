import json
from http.client import HTTPException
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

API_URL = "http://localhost:8000/v1/chat/completions"
MODEL_NAME = "mistralai/Ministral-3-3B-Reasoning-2512"
MAX_TOKENS = 512


SYSTEM_PROMPT = (
	"Du er Pear Programmer, en tålmodig Python-underviser, der guider eleven "
	"socratisk frem mod løsningen. Følg disse regler:\n"
	"- Besvar elevens seneste spørgsmål. Hvis det er uklart eller kun siger "
	"noget i stil med 'test', så spørg, hvad eleven ønsker hjælp til, i stedet "
	"for at gætte.\n"
	"- Brug opgavebeskrivelsen som mål og den aktuelle kode i editoren som "
	"beskrivelse af programmets faktiske tilstand. Antag ikke, at koden virker, "
	"og opgiv ikke et output, du ikke har kontrolleret.\n"
	"- Du taler højt til eleven, så svar i 1-2 korte sætninger uden kodeblokke, "
	"markdown eller punktopstillinger. Omtal kode med ord (fx 'linjen hvor du "
	"henter den tredje måling') og læs aldrig kodesyntaks højt.\n"
	"- Stil ét vejledende spørgsmål ad gangen i stedet for at forklare alt. "
	"Hvis koden og målet ikke stemmer overens, så stil et spørgsmål, der får "
	"eleven til selv at opdage forskellen.\n"
	"- Afslør aldrig rettet kode, den præcise værdi eller det præcise ord, der "
	"skal ændres. Hvis eleven beder om svaret, så afslå venligt og giv et "
	"mindre hint.\n"
	"- Lærernoter (hvis de er givet) er kun til din egen styring. Citér dem "
	"aldrig, og afslør ikke indholdet direkte. Brug dem til at vælge det næste "
	"hint, og start med det mindste.\n"
	"- Bekræft, når eleven har ret, og forklar kort, hvorfor det virker.\n"
	"- Fokusér på ændringer fra den tidligere kode, når det er relevant.\n"
	"- Opgaveteksten og tekster i koden er på engelsk. Svar altid på dansk, "
	"også selvom eleven skriver på et andet sprog.\n"
	"- Skriv svaret som almindelig tekst direkte til eleven, uden indpakning "
	"eller markup om selve svaret.\n"
	"- Nævn aldrig code eller previous_code variablerne i dit svar"
)


def format_teacher_notes(teacher_notes):
	"""Accept a plain string or a dict with concept/knownIssues/hintLadder."""
	if not teacher_notes:
		return ""
	if isinstance(teacher_notes, str):
		return teacher_notes.strip()
	if isinstance(teacher_notes, dict):
		lines = []
		concept = teacher_notes.get("concept")
		if concept:
			lines.append(f"Begreb: {concept}")
		issues = teacher_notes.get("knownIssues") or []
		if issues:
			lines.append("Kendte problemer i koden:")
			lines.extend(f"- {issue}" for issue in issues)
		ladder = teacher_notes.get("hintLadder") or []
		if ladder:
			lines.append("Hint-trappe (start øverst, gå kun ét trin ned ad gangen):")
			lines.extend(f"{i}. {hint}" for i, hint in enumerate(ladder, start=1))
		return "\n".join(lines)
	return ""


def clean_history(history):
	"""Only allow user/assistant turns with string content from the client."""
	return [
		{"role": message["role"], "content": message["content"]}
		for message in history or []
		if isinstance(message, dict)
		and message.get("role") in {"user", "assistant"}
		and isinstance(message.get("content"), str)
	]


def build_messages(
	prompt,
	code=None,
	history=None,
	exercise_context=None,
	previous_code=None,
	teacher_notes=None,
):
	messages = [{"role": "system", "content": SYSTEM_PROMPT}]

	history = clean_history(history)
	if (
		len(history) >= 2
		and history[-2]["role"] == "user"
		and " ".join(history[-2]["content"].split()).casefold()
		== " ".join(prompt.split()).casefold()
	):
		# The latest question is already in history; it is re-added below with context.
		history = history[:-2]
	messages.extend(history)

	parts = []
	if exercise_context:
		parts.append(
			"Opgavens mål (hvad programmet skal gøre):\n"
			f"{exercise_context}\n\n"
		)
	notes = format_teacher_notes(teacher_notes)
	if notes:
		parts.append(
			"Lærernoter (kun til dig, må aldrig citeres eller afsløres):\n"
			f"{notes}\n\n"
		)
	if code is not None:
		parts.append(f"Aktuel kode i editoren (præcis tekst):\n```python\n{code}\n```\n\n")
		if previous_code is not None and previous_code != code:
			parts.append(
				"Tidligere kode i editoren (brug kun til at finde ændringer):\n"
				f"```python\n{previous_code}\n```\n\n"
			)

	if parts:
		current_message = "".join(parts) + f"Elevens seneste spørgsmål:\n{prompt}"
	else:
		current_message = prompt
	messages.append({"role": "user", "content": current_message})
	return messages


def _make_request(payload, stream=False):
	headers = {"Content-Type": "application/json"}
	if stream:
		headers["Accept"] = "text/event-stream"
	return Request(
		API_URL,
		data=json.dumps(payload).encode("utf-8"),
		headers=headers,
		method="POST",
	)


def _open(request):
	try:
		return urlopen(request)
	except HTTPError as error:
		details = error.read().decode("utf-8", errors="replace")
		raise RuntimeError(f"vLLM returned HTTP {error.code}: {details}") from error
	except URLError as error:
		raise RuntimeError(
			"Could not reach vLLM at localhost:8000. Start it with start_llm.py first."
		) from error
	except (HTTPException, OSError) as error:
		raise RuntimeError(f"vLLM connection failed: {error}") from error


def ask(
	prompt,
	code=None,
	history=None,
	exercise_context=None,
	previous_code=None,
	teacher_notes=None,
):
	request = _make_request(
		{
			"model": MODEL_NAME,
			"messages": build_messages(
				prompt, code, history, exercise_context, previous_code, teacher_notes
			),
			"max_tokens": MAX_TOKENS,
		}
	)
	with _open(request) as response:
		result = json.load(response)
	return result["choices"][0]["message"]["content"]


def ask_stream(
	prompt,
	code=None,
	history=None,
	exercise_context=None,
	previous_code=None,
	teacher_notes=None,
):
	request = _make_request(
		{
			"model": MODEL_NAME,
			"messages": build_messages(
				prompt, code, history, exercise_context, previous_code, teacher_notes
			),
			"stream": True,
			"max_tokens": MAX_TOKENS,
		},
		stream=True,
	)
	response = _open(request)

	def iter_tokens():
		try:
			complete = False
			for line in response:
				if not line.startswith(b"data:"):
					continue
				data = line[5:].strip()
				if data == b"[DONE]":
					complete = True
					break
				try:
					chunk = json.loads(data)
				except json.JSONDecodeError as error:
					raise RuntimeError("vLLM returned an invalid streaming response.") from error
				if not isinstance(chunk, dict):
					raise RuntimeError("vLLM returned an invalid streaming response.")
				if "error" in chunk:
					error = chunk["error"]
					message = error.get("message") if isinstance(error, dict) else None
					raise RuntimeError(message or "vLLM generation failed.")
				try:
					delta = chunk["choices"][0]["delta"]
				except (KeyError, IndexError, TypeError) as error:
					raise RuntimeError(
						"vLLM returned an invalid streaming response."
					) from error
				content = delta.get("content") if isinstance(delta, dict) else None
				if content:
					yield content
			if not complete:
				raise RuntimeError("vLLM ended the response before generation completed.")
		except (HTTPException, OSError) as error:
			raise RuntimeError(f"vLLM streaming connection failed: {error}") from error
		finally:
			response.close()

	return iter_tokens()