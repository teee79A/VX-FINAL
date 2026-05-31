package it.unibz.inf.pp.clash.view.screen.sync;

import com.badlogic.gdx.scenes.scene2d.Action;
import it.unibz.inf.pp.clash.view.DisplayManager;

import java.util.concurrent.atomic.AtomicInteger;

/**
 * Keeps track of the number of animations currently running on screen.
 * This is used to pause the methods of a {@link DisplayManager}, until all ongoing animations are completed.
 */
public class AnimationCounter extends Action {
    private final AtomicInteger counter;
    private final float animationDuration;

    public AnimationCounter(float animationDuration) {
        this.animationDuration = animationDuration;
        counter = new AtomicInteger(0);
    }

    public void increment(){
        counter.incrementAndGet();
    }

    public boolean isZero(){
        return counter.get() == 0;
    }

    @Override
    public boolean act(float delta) {
        counter.decrementAndGet();
        return true;
    }

    public float getAnimationDuration() {
        return animationDuration;
    }
}
