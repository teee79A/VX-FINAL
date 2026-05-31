package it.unibz.inf.pp.clash.model.bot.botmoves;

import it.unibz.inf.pp.clash.model.bot.Move;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;

public record DeleteUnit(int rowIndex, int columnIndex) implements Move {
    @Override
    public void perform(GameSnapshot gameSnapshot) {
        var handler = GameEventHandler.getInstance();
        var currentBoard = gameSnapshot.getCurrentBoard();

        handler.deleteUnit(currentBoard.getRealRowIndex(rowIndex), columnIndex, true);

    }
}
