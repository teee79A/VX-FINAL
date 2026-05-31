package it.unibz.inf.pp.clash.model.exceptions;

import it.unibz.inf.pp.clash.model.snapshot.units.Unit;

public class OccupiedTileException extends RuntimeException {
    public OccupiedTileException(Unit unit) {
        super("There is already a unit on this tile:\n"+unit);
    }
}
