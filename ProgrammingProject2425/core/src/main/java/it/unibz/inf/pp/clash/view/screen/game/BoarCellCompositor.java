package it.unibz.inf.pp.clash.view.screen.game;

import com.badlogic.gdx.scenes.scene2d.ui.Table;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.view.screen.Compositor;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.ImageManager;
import it.unibz.inf.pp.clash.view.singletons.ColorManager;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;

import static it.unibz.inf.pp.clash.view.singletons.ColorManager.GuiColor.CELL_BORDER;
import static it.unibz.inf.pp.clash.view.singletons.ColorManager.GuiColor.UNIT_BOUNDARY;

public abstract class BoarCellCompositor extends Compositor {

    final int tileBorderThickness;
    public BoarCellCompositor(EventHandler eventHandler, boolean debug, AnimationCounter animationCounter) {
        super(eventHandler, animationCounter, debug);
        tileBorderThickness = Dimensions.instance().getTileBorderThickness();
    }

    Table drawTable(ColorManager.GuiColor background) {
        return ImageManager.instance().getColoredTable(background);
    }

    Table drawTileBorder(boolean isUnitBoundary){
        return drawTable(
                isUnitBoundary?
                        UNIT_BOUNDARY:
                        CELL_BORDER
        );
    }
}
