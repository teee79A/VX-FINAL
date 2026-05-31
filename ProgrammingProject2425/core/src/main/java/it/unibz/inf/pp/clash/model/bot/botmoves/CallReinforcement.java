package it.unibz.inf.pp.clash.model.bot.botmoves;

import it.unibz.inf.pp.clash.model.bot.Move;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;

public record CallReinforcement() implements Move {
    @Override
    public void perform(GameSnapshot gameSnapshot) {
        var handler = GameEventHandler.getInstance();
        handler.callReinforcement();
    }
}
