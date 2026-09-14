# { "Depends": "py-genlayer:1jb45aa8ynh2a9c9xn3b7qqh8sm5q93hwfp7jqmwsfhh8jpz09h6" }

from genlayer import *
import typing

class LlmHelloWorld(gl.Contract):
    message: str

    def __init__(self):
        self.message = ""

    @gl.public.write
    def set_message(self) -> typing.Any:
        def get_input() -> str:
            return "A new developer just deployed their first Intelligent Contract on GenLayer"

        self.message = gl.eq_principle.prompt_non_comparative(
            get_input,
            task="Write a short, friendly salute of at most one sentence celebrating this moment",
            criteria="""
                The response is a salute or greeting
                It is friendly and positive
                It is at most one sentence
            """,
        )

    @gl.public.view
    def get_message(self) -> str:
        return self.message

