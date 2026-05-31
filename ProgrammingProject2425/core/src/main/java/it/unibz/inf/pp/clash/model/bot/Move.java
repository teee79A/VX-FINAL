package it.unibz.inf.pp.clash.model.bot;

import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;

public interface Move {
    void perform(GameSnapshot gameSnapshot);
}
