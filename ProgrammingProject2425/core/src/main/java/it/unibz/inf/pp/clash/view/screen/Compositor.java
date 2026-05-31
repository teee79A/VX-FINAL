package it.unibz.inf.pp.clash.view.screen;

import com.badlogic.gdx.scenes.scene2d.Actor;
import com.badlogic.gdx.scenes.scene2d.actions.Actions;
import com.badlogic.gdx.scenes.scene2d.actions.SequenceAction;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;
import it.unibz.inf.pp.clash.view.singletons.Dimensions;

public abstract class Compositor {

    protected final EventHandler eventHandler;
    private final AnimationCounter animationCounter;
    protected final boolean debug;

    public Compositor(EventHandler eventHandler, AnimationCounter animationCounter, boolean debug) {
        this.eventHandler = eventHandler;
        this.animationCounter = animationCounter;
        this.debug = debug;
    }

    public Compositor(EventHandler eventHandler, boolean debug) {
        this(eventHandler, null, debug);
    }

    public Table createMainTable() {
        Table table = new Table();
        table.setFillParent(true);
        table.setDebug(debug);
        return table;
    }

    public void addSmallVerticalSpace(Table table) {
        addVerticalSpace(table, Dimensions.instance().getSmallSpace());
    }

    protected void addMediumVerticalSpace(Table table) {
        addVerticalSpace(table, Dimensions.instance().getMediumSpace());
    }
    protected void addLargeVerticalSpace(Table table) {
        addVerticalSpace(table, Dimensions.instance().getLargeSpace());
    }

    protected void addVerticalSpace(Table table, int padding) {
        table.add(new Table()).height(padding);
        table.row();
    }

    // The last of the three actions has the effect of decrementing the counter of ongoing animations.
    protected void addFadeInAnimation(Actor actor) {
        animationCounter.increment();
        SequenceAction actions = new SequenceAction(
                Actions.alpha(0),
                Actions.alpha(1, animationCounter.getAnimationDuration()),
                animationCounter
        );
        actor.addAction(actions);
    }
}
