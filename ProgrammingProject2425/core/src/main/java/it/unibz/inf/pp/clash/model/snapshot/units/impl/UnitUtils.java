package it.unibz.inf.pp.clash.model.snapshot.units.impl;

import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;

import java.util.function.Function;

public class UnitUtils {
    public static Function<MobileUnit.UnitColor, MobileUnit>[] mobileUnitsConstructors() {
        return new Function[]{(Function<MobileUnit.UnitColor, MobileUnit>) Butterfly::new,
                (Function<MobileUnit.UnitColor, MobileUnit>) Unicorn::new,
                (Function<MobileUnit.UnitColor, MobileUnit>) Fairy::new};
    }


    public static boolean isInAttackFormation(MobileUnit unit, int row, int col, NormalizedBoard board) {
        var above = board.getUnit(row - 1, col);
        var twoAbove = board.getUnit(row - 2, col);
        var below = board.getUnit(row + 1, col);
        var twoBelow = board.getUnit(row + 2, col);

        // First: check for configuration where the unit is bottom
        if (above.isPresent() && twoAbove.isPresent()) {
            if (above.get() instanceof MobileUnit aboveUnit && twoAbove.get() instanceof MobileUnit twoAboveUnit) {
                // Note: This works because matches(first, second) is transitive.
                if (aboveUnit.matches(twoAboveUnit) && twoAboveUnit.matches(unit)) {
                    return true;
                }
            }
        }
        // Second: check for configuration where the unit is the first
        if (below.isPresent() && twoBelow.isPresent()) {
            if (below.get() instanceof MobileUnit belowUnit && twoBelow.get() instanceof MobileUnit twoBelowUnit) {
                if (belowUnit.matches(twoBelowUnit) && twoBelowUnit.matches(unit)) {
                    return true;
                }

            }
        }
        // Third: check if the unit is in the middle of an attack formation
        if (above.isPresent() && below.isPresent()) {
            if (above.get() instanceof MobileUnit aboveUnit && below.get() instanceof MobileUnit belowUnit) {
                if (aboveUnit.matches(belowUnit) && belowUnit.matches(unit)) {
                    return true;
                }
            }
        }

        return false;
    }
}
