package it.unibz.inf.pp.clash.view.screen.game;

import com.badlogic.gdx.graphics.Color;
import com.badlogic.gdx.scenes.scene2d.ui.*;
import it.unibz.inf.pp.clash.controller.listeners.UnitLeftClickAndHoverListener;
import it.unibz.inf.pp.clash.controller.listeners.UnitRightClickListener;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.snapshot.units.MobileUnit;
import it.unibz.inf.pp.clash.model.snapshot.units.Unit;
import it.unibz.inf.pp.clash.view.screen.Compositor;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.ColorManager;
import it.unibz.inf.pp.clash.view.singletons.ImageManager;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;
import it.unibz.inf.pp.clash.view.singletons.FontManager;

import static it.unibz.inf.pp.clash.view.singletons.ImageManager.Icon.*;
import static it.unibz.inf.pp.clash.view.singletons.ImageManager.IconSize.SMALL;
import static it.unibz.inf.pp.clash.view.singletons.FontManager.FontType.CELL;

/**
 * Display all the data relative to the unit that occupies the cell
 */
public class OccupiedBoardCellCenterCompositor extends Compositor {

    // Keeps track of which information should be highlighted (with a fade-in animation) when drawing a unit.
    private record Highlights(
            boolean health,
            boolean icon,
            boolean countdown
    ) {
    }

    private static final ImageManager imageManager = ImageManager.instance();

    public OccupiedBoardCellCenterCompositor(EventHandler eventHandler, boolean debug, AnimationCounter animationCounter) {
        super(eventHandler, animationCounter, debug);
    }

    public Table drawCellCenter(int rowindex, int columnIndex, Unit previousUnit, Unit newUnit, boolean isSelectedTile) {

        Highlights highlights = compareUnits(previousUnit, newUnit);
        Table table = new Table();
        table.setDebug(debug);
        addUnitIcon(rowindex, columnIndex, newUnit, highlights, isSelectedTile, table);
        table.row();
        addStats(newUnit, highlights, table);
        return table;
    }

    private Highlights compareUnits(Unit previousUnit, Unit newUnit) {
        if (previousUnit == null) {
            return new Highlights(true, true, true);
        }
        // If the two units are of different types, then highlight all the information available about the new unit
        if (previousUnit.getClass() != newUnit.getClass()) {
            return new Highlights(true, true, true);
        }

        // At this point, then the two units must be of the same type
        if (newUnit instanceof MobileUnit) {
            return compareSameTypeMobileUnits((MobileUnit) previousUnit, (MobileUnit) newUnit);
        }
        return compareSameTypeStaticUnits(previousUnit, newUnit);
    }


    private Highlights compareSameTypeMobileUnits(MobileUnit previousUnit, MobileUnit newUnit) {
        // If the two units are of different colors, then highlight all the information available about the new unit
        if (newUnit.getColor() != previousUnit.getColor()) {
            return new Highlights(true, true, true);
        }
        return new Highlights(
                previousUnit.getHealth() != newUnit.getHealth(),
                false,
                previousUnit.getAttackCountdown() != newUnit.getAttackCountdown()
        );
    }

    private Highlights compareSameTypeStaticUnits(Unit previousUnit, Unit newUnit) {
        return new Highlights(
                previousUnit.getHealth() != newUnit.getHealth(),
                false,
                false
        );
    }

    private void addStats(Unit unit, Highlights highlights, Table table) {
        String healthString = String.valueOf(unit.getHealth());

        Label label = getLabel(healthString);
        if (highlights.health) {
            addFadeInAnimation(label);
        }
        table.add(label).expand();
        addAttackCountdown(unit, highlights, table);
    }


    private Label getLabel(int value) {
        return getLabel(value, null);
    }

    private Label getLabel(String value) {
        return FontManager.instance().getLabel(value, CELL, null);
    }

    private Label getLabel(int value, Color color) {
        return FontManager.instance().getLabel(
                " " + value + " ",
                CELL,
                color
        );
    }

    private Image getCountdownIcon() {
        return imageManager.getIcon(COUNTDOWN, SMALL);
    }

    private void addUnitIcon(int rowIndex, int columnIndex, Unit unit, Highlights highlights, boolean isSelectedTile,
                             Table table) {
        if (unit instanceof MobileUnit) {
            addMobileUnitIcon(rowIndex, columnIndex, (MobileUnit) unit, highlights, isSelectedTile, table);
        } else {
            addStaticUnitIcon(rowIndex, columnIndex, unit, highlights, isSelectedTile, table);
        }
    }

    private void addStaticUnitIcon(int rowIndex, int columnIndex, Unit unit, Highlights highlights,
                                   boolean isSelectedTile, Table table) {
        ImageButton button = imageManager.getStaticUnitButton(
                unit,
                isSelectedTile
        );
        addListeners(rowIndex, columnIndex, button);
        if (highlights.icon) {
            addFadeInAnimation(button);
        }
        table.add(button)
                .expand();
    }

    private void addMobileUnitIcon(int rowIndex, int columnIndex, MobileUnit unit, Highlights highlights,
                                   boolean isSelectedTile, Table table) {
        ImageButton button = imageManager.getMobileUnitButton(
                unit,
                unit.getColor(),
                isSelectedTile
        );
        addListeners(rowIndex, columnIndex, button);
        if (highlights.icon) {
            addFadeInAnimation(button);
        }
        table.add(button)
                .colspan(
                        unit.getAttackCountdown() >= 0 ? 3 : 1
                ).expand();
    }

    private void addListeners(int rowIndex, int columnIndex, ImageButton button) {
        button.addListener(
                new UnitLeftClickAndHoverListener(
                        rowIndex,
                        columnIndex,
                        eventHandler
                ));
        button.addListener(
                new UnitRightClickListener(
                        rowIndex,
                        columnIndex,
                        eventHandler
                ));
    }

    private void addAttackCountdown(Unit unit, Highlights highlights, Table table) {
        if (unit instanceof MobileUnit) {
            int countdown = ((MobileUnit) unit).getAttackCountdown();
            if (countdown >= 0) {
                int length = Dimensions.instance().getSmallSquareIconLength();
                Image countdownIcon = getCountdownIcon();
                Label countdownLabel = getLabel(
                        countdown,
                        ColorManager.instance().getColor(ColorManager.GuiColor.COUNTDOWN)
                );
                if (highlights.countdown) {
                    addFadeInAnimation(countdownIcon);
                    addFadeInAnimation(countdownLabel);
                }
                table.add(countdownIcon).height(length).width(length);
                table.add(countdownLabel);
            }
        }
    }
}
