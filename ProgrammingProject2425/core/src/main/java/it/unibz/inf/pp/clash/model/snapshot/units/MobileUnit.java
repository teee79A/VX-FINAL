package it.unibz.inf.pp.clash.model.snapshot.units;

/**
 * Units that can attack and/or can be moved (as opposed to walls for instance).
 */
public interface MobileUnit extends Unit, AttackingUnit {

    enum UnitColor {
        ONE, TWO, THREE;

        public String getPrintString() {
            return switch (this) {
                case ONE -> "1";
                case TWO -> "2";
                case THREE -> "3";
                default -> throw new IllegalArgumentException("Unknown color: " + this);
            };
        }
    }


    /**
     * @return the unit's color (two units of the same type may have different colors)
     */
    UnitColor getColor();

    /**
     * @return number of turns before this unit attacks; returns a value < 0 if no attack is scheduled for this unit.
     */
    int getAttackCountdown();

    /**
     * Sets the number of turns before this unit attacks; a value < 0 means that no attack is
     * scheduled for this unit.
     */
    void setAttackCountdown(int attackCountDown);

    /**
     * @return whether this unit is a "match" for a possible formation with another unit
     */
    boolean matches(MobileUnit unit);
}
