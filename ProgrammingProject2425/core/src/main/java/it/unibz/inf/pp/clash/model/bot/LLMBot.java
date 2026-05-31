package it.unibz.inf.pp.clash.model.bot;

import it.unibz.inf.pp.clash.logic.Utils;
import it.unibz.inf.pp.clash.model.bot.botmoves.CallReinforcement;
import it.unibz.inf.pp.clash.model.bot.botmoves.DeleteUnit;
import it.unibz.inf.pp.clash.model.bot.botmoves.MoveUnit;
import it.unibz.inf.pp.clash.model.bot.botmoves.SkipTurn;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Butterfly;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Fairy;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Unicorn;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Wall;
import it.unibz.inf.pp.clash.view.singletons.FileManager;

import java.io.*;
import java.net.HttpURLConnection;
import java.net.URL;
import java.nio.charset.StandardCharsets;
import java.util.Optional;

public class LLMBot implements BotPlayer {

    static private boolean debug = false; // Flag to enable / disable logging.

    private final StringBuilder llmContext = new StringBuilder();
    private final String apiUrl = "https://api.groq.com/openai/v1/chat/completions";

    private String getApiKey() {
        String apiKey = System.getenv("GROQ_API_KEY");
        if (apiKey == null || apiKey.isEmpty()) {
            throw new IllegalStateException("GROQ_API_KEY environment variable not set");
        }
        return apiKey;
    }


    // Sends a message to groq and returns the content of the reply
    private Optional<String> sendRestMessage() {
        try {
            URL url = new URL(apiUrl);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("POST");
            connection.setRequestProperty("Content-Type", "application/json");
            connection.setRequestProperty("Authorization", "Bearer " + getApiKey());
            connection.setDoOutput(true);

            StringBuilder jsonSb = new StringBuilder();
            jsonSb.append("{\n\"messages\":[\n");
            jsonSb.append(llmContext.toString());
            jsonSb.append("""
                    ],
                     "model": "meta-llama/llama-4-scout-17b-16e-instruct",
                     "temperature": 1,
                     "max_completion_tokens": 1024,
                     "top_p": 1,
                     "stream": false,
                     "stop": null
                    }
                    """.stripIndent());

            var jsonPayload = jsonSb.toString();
            if (debug)
                System.out.println("JSON Payload: " + jsonPayload);


            try (OutputStream os = connection.getOutputStream()) {
                byte[] input = jsonPayload.getBytes(StandardCharsets.UTF_8);
                os.write(input, 0, input.length);
            }

            int responseCode = connection.getResponseCode();
            if (debug)
                System.out.println("Response Code: " + responseCode);
            if (responseCode == HttpURLConnection.HTTP_OK) {
                try (var reader = new BufferedReader(new InputStreamReader(connection.getInputStream(), "utf-8"))) {
                    StringBuilder response = new StringBuilder();
                    String responseLine;
                    while ((responseLine = reader.readLine()) != null) {
                        response.append(responseLine.trim());
                    }

                    var entireResponse = response.toString();
                    String split = entireResponse.split("content\":")[1].split("}")[0];
                    // Remove the quotations around strings
                    var responseContent = split.trim().substring(1, split.length() - 1);


                    if (debug)
                        System.out.println("Response: " + responseContent);
                    return Optional.of(responseContent);

                }
            }

        } catch (IOException e) {
            throw new RuntimeException(e);
        }
        return Optional.empty();
    }

    private void appendMessageToLLMContext(String role, String content) {
        if (!llmContext.isEmpty()) {
            llmContext.append(",\n");
        }
        llmContext.append("{\n\"role\":\"");
        llmContext.append(role);
        llmContext.append("\",\n\"content\":\"");
        llmContext.append(content);
        llmContext.append("\"\n}");
    }

    private String populateTutorialWithData(String tutorialPrompt) {
        tutorialPrompt = tutorialPrompt.replace("$1", Integer.toString(Butterfly.HEALTH));
        tutorialPrompt = tutorialPrompt.replace("$2", Integer.toString(Butterfly.ATTACK));
        tutorialPrompt = tutorialPrompt.replace("$3", Integer.toString(Butterfly.ATTACK_COUNTDOWN));
        tutorialPrompt = tutorialPrompt.replace("$4", Integer.toString(Fairy.HEALTH));
        tutorialPrompt = tutorialPrompt.replace("$5", Integer.toString(Fairy.ATTACK));
        tutorialPrompt = tutorialPrompt.replace("$6", Integer.toString(Fairy.ATTACK_COUNTDOWN));
        tutorialPrompt = tutorialPrompt.replace("$7", Integer.toString(Unicorn.HEALTH));
        tutorialPrompt = tutorialPrompt.replace("$8", Integer.toString(Unicorn.ATTACK));
        tutorialPrompt = tutorialPrompt.replace("$9", Integer.toString(Unicorn.ATTACK_COUNTDOWN));
        tutorialPrompt = tutorialPrompt.replace("$10", Integer.toString(Wall.HEALTH));
        return tutorialPrompt;
    }

    private String escapeJson(String value) {
        return value.replace("\\", "\\\\")
                .replace("\"", "\\\"")
                .replace("\n", "\\n")
                .replace("\r", "\\r")
                .replace("\t", "\\t")
                .replace("\b", "\\b")
                .replace("\f", "\\f");
    }

    private Move parseLLMResponse(String response) {
        if (response.startsWith("MoveUnit")) {
            String[] parts = response.split("\\(")[1].split("\\)")[0].split(",");
            int fromColumn = Integer.parseInt(parts[0].trim());
            int toColumn = Integer.parseInt(parts[1].trim());
            return new MoveUnit(fromColumn, toColumn);
        } else if (response.startsWith("DeleteUnit")) {
            String[] parts = response.split("\\(")[1].split("\\)")[0].split(",");
            int row = Integer.parseInt(parts[0].trim());
            int column = Integer.parseInt(parts[1].trim());
            return new DeleteUnit(row, column);
        } else if (response.equals("SkipTurn")) {
            return new SkipTurn();
        } else if (response.equals("CallReinforcement")) {
            return new CallReinforcement();
        } else {
            throw new IllegalArgumentException("Unknown move type: " + response);
        }

    }

    // See: https://console.groq.com/docs/overview
    private Move chooseMove(GameSnapshot gs) {
        StringBuilder llmPrompt = new StringBuilder();
        if (llmContext.isEmpty()) {
            var tutorialPrompt = populateTutorialWithData(FileManager.instance().loadLLMTutorialPrompt());
            llmPrompt.append(tutorialPrompt);
        }
        llmPrompt.append("\n--- Your board ---\n");
        var llmBoard = Utils.getBoardString(gs.getCurrentBoard());
        llmPrompt.append(llmBoard);
        llmPrompt.append("\n-- Your opponent's board --\n");
        var opponentBoard = Utils.getBoardString(gs.getNonCurrentBoard());
        llmPrompt.append(opponentBoard);
        llmPrompt.append("\n--- Your stats ---\n");
        llmPrompt.append("Reinforcement size left: ").append(gs.getSizeOfReinforcement(gs.getActivePlayer())).append("\n");
        llmPrompt.append("Turns left: ").append(gs.getNumberOfRemainingActions()).append("\n");
        llmPrompt.append("Your Health: ").append(gs.getHero(gs.getActivePlayer()).getHealth()).append("\n");
        llmPrompt.append("Enemy Health: ").append(gs.getHero(gs.getNonActivePlayer()).getHealth()).append("\n");
        llmPrompt.append("\n--- End ---\n");
        llmPrompt.append("Reply _only_ with the move you want to play. Do not include any other text. Substitute the potential arguments and reply in following the format: \n\n");
        llmPrompt.append("""
                * MoveUnit(int fromColumn, int toColumn)
                * DeleteUnit(int row, int column)
                * SkipTurn
                * CallReinforcement
                """);

        appendMessageToLLMContext("user", escapeJson(llmPrompt.toString()));
        if (debug)
            System.out.println("LLM Prompt: " + llmPrompt.toString());
        var responseMaybe = sendRestMessage();
        // This might throw an exception, but we catch it in PlayMove
        appendMessageToLLMContext("assistant", responseMaybe.get());
        return parseLLMResponse(responseMaybe.get());


    }

    @Override
    public void PlayMove(GameSnapshot gs) {
        try {
            chooseMove(gs).perform(gs);
        } catch (RuntimeException e) {
            // If there was an error, just skip the turn. We probably got wrong data from the LLM.
            new SkipTurn().perform(gs);
        }
    }
}
