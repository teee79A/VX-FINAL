package it.unibz.inf.pp.clash.model;

import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

import java.util.function.Function;

@FunctionalInterface
public interface BoardInitializer {
    void apply(Board board, int amount, Function<MobileUnit.UnitColor, MobileUnit>[] unitConstructors);
}
