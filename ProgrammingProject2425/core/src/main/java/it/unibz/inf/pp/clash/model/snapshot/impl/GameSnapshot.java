package it.unibz.inf.pp.clash.model.snapshot.impl;

import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.Hero;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;

public class GameSnapshot extends AbstractSnapshot {

    public GameSnapshot(Hero firstHero, Hero secondHero, Board board, Player activePlayer, int actionsRemaining) {
        super(firstHero, secondHero, board, activePlayer, actionsRemaining, null);
    }


    public void decrementActions() {
        if (this.actionsRemaining > 0) {
            this.actionsRemaining--;
        }
    }

    public void setActionsRemaining(int count) {
        this.actionsRemaining = count;
    }

    public void clearOngoingMove() {
        this.ongoingMove = null;
    }

    @Override
    public int getSizeOfReinforcement(Snapshot.Player player) {
        return NormalizedBoardImpl.getRemovedUnitsCount(player);
    }

}

