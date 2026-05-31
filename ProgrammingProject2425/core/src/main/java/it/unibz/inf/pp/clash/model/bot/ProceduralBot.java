package it.unibz.inf.pp.clash.model.bot;

import it.unibz.inf.pp.clash.model.bot.botmoves.CallReinforcement;
import it.unibz.inf.pp.clash.model.bot.botmoves.DeleteUnit;
import it.unibz.inf.pp.clash.model.bot.botmoves.MoveUnit;
import it.unibz.inf.pp.clash.model.bot.botmoves.SkipTurn;
import it.unibz.inf.pp.clash.model.snapshot.impl.GameSnapshot;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;

import java.util.*;

public class ProceduralBot implements BotPlayer {

    @Override
    public void PlayMove(GameSnapshot gs) {
        Move move = chooseMove(gs);
        move.perform(gs);
    }

    private Move chooseMove(GameSnapshot gs) {
        // Step 1: Check if the board is too full.
        // If the size of reinforcements exceeds the available spots, delete random units.
        // If Step 1 fails, proceed to Step 2.
        // Step 2: Look for possible attack formations.
        // If Step 2 fails, proceed to Step 3.
        // Step 3: Identify spots for unit deletion, in order to create attack formation.
        // If Step 3 fails, proceed to Step 4.
        // Step 4: Call reinforcements.
        // If reinforcements are unavailable, skip the turn.

        var botBoard = gs.getCurrentBoard();
        var boardStacks = botBoard.getNormalizedBoard();

        // -- Check if the board is too full --
        if (botBoard.getAvailableSpots() < gs.getSizeOfReinforcement(gs.getActivePlayer())) {
            var rng = new Random();
            List<Integer> stackIndicesWithUnits = new ArrayList<>();
            for (int i = 0; i < boardStacks.length; i++) {
                if (!boardStacks[i].isEmpty()) stackIndicesWithUnits.add(i);
            }
            var colIndex = rng.nextInt(stackIndicesWithUnits.size());
            var stack = boardStacks[stackIndicesWithUnits.get(colIndex)];
            var rowIndex = rng.nextInt(stack.size());

            return new DeleteUnit(rowIndex, colIndex);
        }

        // -- Step 2 look for attack formations --
        for (int i = 0; i < boardStacks.length; i++) {
            Unit leftUnit;
            try {
                leftUnit = boardStacks[i].peek();
            } catch (EmptyStackException ex) {
                continue;
            }
            if (!(leftUnit instanceof MobileUnit mobileLeftUnit)) continue;
            for (int j = 0; j < boardStacks.length; j++) {
                if (i == j) continue;
                var rightUnits = boardStacks[j];
                // Check if column is full
                if ((rightUnits.size() - 1) == botBoard.getMaxRowIndex()) continue;
                // There cant be an attack formation if only 1 unit is in the column
                if (rightUnits.size() <= 1) continue;

                var topRightUnit = rightUnits.get(rightUnits.size() - 1);
                var oneBeforeTopRightUnit = rightUnits.get(rightUnits.size() - 2);

                if (!(topRightUnit instanceof MobileUnit mTopRightUnit) || !(oneBeforeTopRightUnit instanceof MobileUnit mOneBeforeTopRightUnit))
                    continue;

                if (mobileLeftUnit.getClass() == mTopRightUnit.getClass() && mobileLeftUnit.getClass() == mOneBeforeTopRightUnit.getClass()
                        && mobileLeftUnit.getColor().equals(mTopRightUnit.getColor()) && mobileLeftUnit.getColor().equals(mOneBeforeTopRightUnit.getColor())
                ) {
                    return new MoveUnit(i, j);
                }
            }
        }

        // -- Step 3 look for unit deletions to create attack formation --
        for (int col = 0; col < boardStacks.length; col++) {
            var stack = boardStacks[col];
            if (stack.size() > 4) {
                for (int row = 1; row < stack.size(); row++) {
                    var _unit = botBoard.getUnit(row, col).get();
                    if (!(_unit instanceof MobileUnit unit)) continue;
                    if (botBoard.isUnitInFormation(unit)) continue;
                    /*
                     * Check for this formation:
                     *        o         o
                     *        o    or   x
                     *        x         o
                     *        o         o
                     */
                    var twoPrevUnitMaybe = botBoard.getUnit(row - 2, col);
                    var onePrevUnitMaybe = botBoard.getUnit(row - 1, col);
                    var twoNextUnitMaybe = botBoard.getUnit(row + 2, col);
                    var oneNextUnitMaybe = botBoard.getUnit(row + 1, col);

                    // First formation
                    if (oneNextUnitMaybe.isPresent() && twoNextUnitMaybe.isPresent() && onePrevUnitMaybe.isPresent()) {
                        if (oneNextUnitMaybe.get() instanceof MobileUnit oneNextUnit &&
                                twoNextUnitMaybe.get() instanceof MobileUnit twoNextUnit &&
                                onePrevUnitMaybe.get() instanceof MobileUnit onePrevUnit &&
                                (!unit.matches(oneNextUnit) && !unit.matches(twoNextUnit) && !unit.matches(onePrevUnit)) &&
                                (oneNextUnit.matches(twoNextUnit) && twoNextUnit.matches(onePrevUnit)) // This is a transitive relation, so it works.
                        ) {
                            return new DeleteUnit(row, col);
                        }
                    }
                    // Second formation
                    if (oneNextUnitMaybe.isPresent() && twoPrevUnitMaybe.isPresent() && onePrevUnitMaybe.isPresent()) {
                        if (oneNextUnitMaybe.get() instanceof MobileUnit oneNextUnit &&
                                twoPrevUnitMaybe.get() instanceof MobileUnit twoPrevUnit &&
                                onePrevUnitMaybe.get() instanceof MobileUnit onePrevUnit &&
                                (!unit.matches(oneNextUnit) && !unit.matches(twoPrevUnit) && !unit.matches(onePrevUnit)) &&
                                (oneNextUnit.matches(twoPrevUnit) && twoPrevUnit.matches(onePrevUnit))
                        ) {
                            return new DeleteUnit(row, col);
                        }
                    }

                }
            }
        }

        if (gs.getSizeOfReinforcement(gs.getActivePlayer()) > 0) {
            return new CallReinforcement();
        } else {
            // Prevent the bot from getting stuck. Make a random move.
            int randFrom, randTo;

            while (true) {
                randFrom = new Random().nextInt(botBoard.getMaxColumnIndex() + 1);
                randTo = new Random().nextInt(botBoard.getMaxColumnIndex() + 1);

                if (randFrom == randTo) continue;
                if (boardStacks[randFrom].isEmpty()) continue;
                if (boardStacks[randTo].size() - 1 == botBoard.getMaxRowIndex()) continue;

                return new MoveUnit(randFrom, randTo);
            }

        }


    }

}
