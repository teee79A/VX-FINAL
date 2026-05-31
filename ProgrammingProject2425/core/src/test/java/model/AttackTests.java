package model;

import com.badlogic.gdx.Gdx;
import com.badlogic.gdx.Input;
import it.unibz.inf.pp.clash.model.impl.GameEventHandler;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Butterfly;
import it.unibz.inf.pp.clash.model.snapshot.units.impl.Fairy;
import it.unibz.inf.pp.clash.view.DisplayManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;

public class AttackTests {


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
    public void itShouldCreateAFormationAndAttack() {
        eventHandler.newGame("Hero1", "Hero2", (board, amount, unitConstructors) -> {
            var normalizedP1Board = eventHandler.getSnapshot().getCurrentBoard();
            normalizedP1Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.ONE));
        }, 3, 5);

        var butterfly = new Butterfly(MobileUnit.UnitColor.ONE);
        var enemyHero = eventHandler.getSnapshot().getHero(Snapshot.Player.SECOND);
        var initialHealth = enemyHero.getHealth();

        for (int i = 0; i < butterfly.getInitialAttackCountdown(); i++) {
            eventHandler.skipTurn();
            eventHandler.skipTurn();
        }

        assertEquals(enemyHero.getHealth(), initialHealth - butterfly.getAttackDamage() * 3);
    }

    @Test
    public void itShouldDestroyAnEnemyFormation() {
        eventHandler.newGame("Hero1", "Hero2", (board, amount, unitConstructors) -> {
            var normalizedP1Board = eventHandler.getSnapshot().getCurrentBoard();
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));
        }, 3, 5);

        var fairy = new Fairy(MobileUnit.UnitColor.ONE);
        var butterfly = new Butterfly(MobileUnit.UnitColor.ONE);

        var enemyHero = eventHandler.getSnapshot().getHero(Snapshot.Player.SECOND);
        var initialHealth = enemyHero.getHealth();

        for (int i = 0; i < fairy.getInitialAttackCountdown() - 1; i++) {
            eventHandler.skipTurn();
            eventHandler.skipTurn();
        }
        // Add a formation to the enemy board
        var enemyHeroBoard = eventHandler.getSnapshot().getNormalizedBoard(Snapshot.Player.SECOND);
        enemyHeroBoard.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));
        enemyHeroBoard.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));
        enemyHeroBoard.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));

        eventHandler.skipTurn();
        eventHandler.skipTurn();
        // The fairys have attacked


        assertTrue(enemyHeroBoard.getUnit(0).isEmpty());
        // Check that the butterfly attack formation tanked the correct damage
        assertEquals(enemyHero.getHealth(), initialHealth + butterfly.getAttackDamage() * 3 - fairy.getAttackDamage() * 3);
    }

    @Test
    public void itShouldLowerTheFormationAttackIfAttacked() {

        eventHandler.newGame("Hero1", "Hero2", (board, amount, unitConstructors) -> {
            var normalizedP1Board = eventHandler.getSnapshot().getCurrentBoard();
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));
            normalizedP1Board.addUnit(0, new Fairy(MobileUnit.UnitColor.ONE));

            var normalizedP2Board = eventHandler.getSnapshot().getNormalizedBoard(Snapshot.Player.SECOND);
            // NOTE: the butterfly should attack faster than the fairy
            normalizedP2Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));
            normalizedP2Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));
            normalizedP2Board.addUnit(0, new Butterfly(MobileUnit.UnitColor.TWO));
        }, 3, 5);

        var fairy = new Fairy(MobileUnit.UnitColor.ONE);
        var butterfly = new Butterfly(MobileUnit.UnitColor.TWO);

        var enemyHero = eventHandler.getSnapshot().getHero(Snapshot.Player.SECOND);
        var initialHealth = enemyHero.getHealth();

        for (int i = 0; i < fairy.getInitialAttackCountdown(); i++) {
            eventHandler.skipTurn();
            eventHandler.skipTurn();
        }

        assertEquals(enemyHero.getHealth(), initialHealth - (fairy.getAttackDamage() * 3 - butterfly.getAttackDamage() * 3));


    }
}
