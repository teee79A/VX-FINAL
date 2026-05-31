package it.unibz.inf.pp.clash.model.snapshot.units;

/**
 * A unit is anything that may be standing on a tile (including walls for instance).
 */
public interface Unit {

    /**
     * @return remaining health points
     */
    int getHealth();

    void setHealth(int health);

    String getPrintString();
}
