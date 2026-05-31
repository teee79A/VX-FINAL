#!/usr/bin/env python3
from __future__ import annotations

import argparse
import asyncio
import os
from pathlib import Path

from dotenv import load_dotenv

from autogen_agentchat.agents import AssistantAgent
from autogen_agentchat.base import TaskResult
from autogen_ext.models.openai import OpenAIChatCompletionClient
from autogen_ext.tools.mcp import McpWorkbench, StreamableHttpServerParams


ROOT = Path(__file__).resolve().parents[1]


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="VXSTATION local Code Interpreter MCP chat")
    parser.add_argument("--task", help="Run one task and exit.")
    parser.add_argument("--model", default=os.getenv("VXSTATION_OPENAI_MODEL", "gpt-5"))
    parser.add_argument("--toolkit", default=os.getenv("VXSTATION_COMPOSIO_TOOLKIT", "codeinterpreter"))
    parser.add_argument("--user-id", default=os.getenv("USER_ID"))
    parser.add_argument("--agent-name", default="vxstation_codeinterpreter")
    parser.add_argument("--max-tool-iterations", type=int, default=10)
    parser.add_argument("--no-stream", action="store_true")
    return parser.parse_args()


def require_env(name: str, current: str | None = None) -> str:
    value = current if current is not None else os.getenv(name)
    if value and value.strip():
        return value.strip()
    raise RuntimeError(f"Missing required environment variable: {name}")


def extract_text(result: TaskResult) -> str:
    for message in reversed(result.messages):
        content = getattr(message, "content", None)
        if isinstance(content, str) and content.strip():
            return content.strip()
    return ""


async def run_once(agent: AssistantAgent, task: str) -> None:
    result = await agent.run(task=task)
    text = extract_text(result)
    print(text if text else "[no assistant reply]")


async def run_repl(agent: AssistantAgent) -> None:
    print("VXSTATION Code Interpreter chat ready. Type 'exit' or 'quit' to stop.\n")
    while True:
        try:
            user_input = input("You: ").strip()
        except (EOFError, KeyboardInterrupt):
            print()
            break

        if user_input.lower() in {"exit", "quit", "bye"}:
            break
        if not user_input:
            continue

        try:
            await run_once(agent, user_input)
        except Exception as exc:  # noqa: BLE001
            print(f"Agent error: {exc}")
        print()


async def main_async() -> None:
    load_dotenv(ROOT / ".env")
    load_dotenv()
    args = parse_args()

    composio_api_key = require_env("COMPOSIO_API_KEY")
    openai_api_key = require_env("OPENAI_API_KEY")
    user_id = require_env("USER_ID", args.user_id)

    from composio import Composio

    composio = Composio(api_key=composio_api_key)
    session = composio.create(user_id=user_id, toolkits=[args.toolkit])

    session_headers = dict(getattr(session.mcp, "headers", {}) or {})
    session_headers.setdefault("x-api-key", composio_api_key)

    server_params = StreamableHttpServerParams(
        url=session.mcp.url,
        timeout=30.0,
        sse_read_timeout=300.0,
        terminate_on_close=True,
        headers=session_headers,
    )

    model_client = OpenAIChatCompletionClient(model=args.model, api_key=openai_api_key)
    try:
        async with McpWorkbench(server_params=server_params) as workbench:
            agent = AssistantAgent(
                name=args.agent_name,
                description="VXSTATION local Code Interpreter assistant.",
                model_client=model_client,
                workbench=workbench,
                model_client_stream=not args.no_stream,
                reflect_on_tool_use=True,
                max_tool_iterations=args.max_tool_iterations,
                system_message=(
                    "You are the VXSTATION local Code Interpreter assistant. "
                    "Use MCP tools when execution, files, or analysis are required."
                ),
            )

            if args.task:
                await run_once(agent, args.task)
            else:
                await run_repl(agent)
    finally:
        await model_client.close()


if __name__ == "__main__":
    asyncio.run(main_async())
