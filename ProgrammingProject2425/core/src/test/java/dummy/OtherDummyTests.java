package dummy;

import it.unibz.inf.pp.clash.model.exceptions.OccupiedTileException;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.impl.BoardImpl;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Fairy;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Unicorn;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit.*;

public class OtherDummyTests {



    /**
     * Checks that an exception is thrown if two units are added to the same tile
     */
    @Test
    public void testAddRemoveUnit() {
        Board board = new BoardImpl(new Unit[4][4]);

        board.addUnit(1,0, new Unicorn(UnitColor.ONE));
        assertTrue(board.getUnit(1,0).isPresent());

        board.removeUnit(1,0);
        assertTrue(board.getUnit(1,0).isEmpty());
    }

    /**
     * Checks that an exception is thrown if two units are added to the same tile
     */
    @Test
    public void testOccupiedTile() {
        Board board = new BoardImpl(new Unit[4][4]);
        board.addUnit(1,0, new Unicorn(MobileUnit.UnitColor.ONE));
        assertThrows(
                OccupiedTileException.class,
                () -> board.addUnit(1,0, new Fairy(UnitColor.THREE))
        );
    }

}