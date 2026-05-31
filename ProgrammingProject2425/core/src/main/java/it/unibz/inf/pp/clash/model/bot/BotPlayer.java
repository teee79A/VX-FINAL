package it.unibz.inf.pp.clash.model.bot;

import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;

public interface BotPlayer {

    // How much the bot has to wait to play the nextMove
    public static int BOT_MOVE_DELAY = 1000;

    static BotPlayer getBotPlayerFromName(String name) {
        if (name.equals("Bot(LLM)")) {
            return new LLMBot();
        }
        return new ProceduralBot();
    }

    void PlayMove(GameSnapshot gs);

}
