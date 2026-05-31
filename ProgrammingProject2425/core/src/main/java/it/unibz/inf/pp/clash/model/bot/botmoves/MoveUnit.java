package it.unibz.inf.pp.clash.model.bot.botmoves;

import it.unibz.inf.pp.clash.model.bot.Move;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;

public record MoveUnit(int fromColumn, int toColumn) implements Move {
    @Override
    public void perform(GameSnapshot gameSnapshot) {
        var handler = GameEventHandler.getInstance();
        var currentBoard = gameSnapshot.getCurrentBoard();
        var boardStacks = currentBoard.getNormalizedBoard();
        handler.selectTile(currentBoard.getRealRowIndex(boardStacks[fromColumn].size() - 1), fromColumn, true);
        handler.selectTile(currentBoard.getRealRowIndex(boardStacks[toColumn].size()), toColumn, true);
    }
}
