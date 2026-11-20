import unittest

from prompt import (
	build_messages,
	strip_answer_wrappers,
	strip_answer_wrappers_from_stream,
)


class PromptTests(unittest.TestCase):
	def test_system_instructions_are_present_without_code(self):
		messages = build_messages("test")

		self.assertEqual(messages[0]["role"], "system")
		self.assertIn("spørg, hvad eleven ønsker hjælp til", messages[0]["content"])
		self.assertIn("Svar altid på dansk", messages[0]["content"])
		self.assertEqual(messages[-1], {"role": "user", "content": "test"})

	def test_prompt_labels_exercise_and_code_as_context(self):
		messages = build_messages(
			"Why does this fail?",
			code="print(value)",
			exercise_context="Print a value.",
			previous_code="value = 1",
		)

		self.assertIn("Opgavens mål (hvad programmet skal gøre)", messages[-1]["content"])
		self.assertIn("Aktuel kode i editoren (præcis tekst)", messages[-1]["content"])
		self.assertIn("Tidligere kode i editoren", messages[-1]["content"])
		self.assertTrue(
			messages[-1]["content"].endswith(
				"Elevens seneste spørgsmål:\nWhy does this fail?"
			)
		)
		self.assertNotIn("<editor_code>", messages[-1]["content"])

	def test_answer_wrappers_are_removed_from_fragmented_stream(self):
		tokens = ["<ans", "wer>\nThe third measurement", " is 0.8.", "</ans", "wer>"]

		answer = "".join(strip_answer_wrappers_from_stream(tokens))

		self.assertEqual(answer, "\nThe third measurement is 0.8.")
		self.assertEqual(strip_answer_wrappers("<ANSWER> hello </answer>"), "hello")


if __name__ == "__main__":
	unittest.main()
