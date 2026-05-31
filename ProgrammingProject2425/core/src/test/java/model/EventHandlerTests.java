package model;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import it.unibz.inf.pp.clash.logic.Utils;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit.UnitColor;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Butterfly;
import it.unibz.inf.pp.clash.view.DisplayManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.*;

public class EventHandlerTests {

    private DisplayManager displayManager;
    private GameEventHandler eventHandler;

    @BeforeEach
    public void setUp() {
        displayManager = Mockito.mock(DisplayManager.class);
        Input mockInput = Mockito.mock(Input.class);
        Gdx.input = mockInput;
        eventHandler = GameEventHandler.getInstance();
        if (eventHandler == null) {
            eventHandler = new GameEventHandler(displayManager);
        }

    }

    @Test
    public void itShouldMoveAUnit() {
        eventHandler.newGame("Hero1", "Hero2", (board, amount, unitConstructors) -> {
            var normalizedP1Board = eventHandler.getSnapshot().getCurrentBoard();
            normalizedP1Board.addUnit(0, new Butterfly(UnitColor.ONE));
        }, 3, 5);

        var snapshot = eventHandler.getSnapshot();
        Utils.PrintBoard(snapshot.getBoard());
        var normalizedPlayerBoard = eventHandler.getSnapshot().getNormalizedBoard(Snapshot.Player.FIRST);
        assertTrue(normalizedPlayerBoard.getUnit(0).isPresent());

        // Move the unit from (3, 0) to (3, 1)
        eventHandler.selectTile(3, 0);
        eventHandler.selectTile(3, 1);

        assertTrue(normalizedPlayerBoard.getUnit(0).isEmpty());
        assertTrue(normalizedPlayerBoard.getUnit(1).isPresent());
    }

    @Test
    public void itShouldMoveAUnitToTheSameColumn() {
        eventHandler.newGame("Hero1", "Hero2", (board, amount, unitConstructors) -> {
            var normalizedP1Board = eventHandler.getSnapshot().getCurrentBoard();
            normalizedP1Board.addUnit(0, new Butterfly(UnitColor.ONE));
        }, 3, 5);

        var snapshot = eventHandler.getSnapshot();
        var normalizedPlayerBoard = snapshot.getCurrentBoard();
        assertTrue(normalizedPlayerBoard.getUnit(0).isPresent());

        Utils.PrintBoard(snapshot.getBoard());
        // Move the unit from (3, 0) to (3, 1)
        eventHandler.selectTile(3, 0);
        eventHandler.selectTile(3, 0);

        Utils.PrintBoard(snapshot.getBoard());
        assertTrue(normalizedPlayerBoard.getUnit(0).isPresent());

        eventHandler.selectTile(3, 0);
        eventHandler.selectTile(4, 0);
        assertTrue(normalizedPlayerBoard.getUnit(0).isPresent());
        eventHandler.selectTile(3, 0);
        eventHandler.selectTile(5, 0);
        assertTrue(normalizedPlayerBoard.getUnit(0).isPresent());
    }
}
