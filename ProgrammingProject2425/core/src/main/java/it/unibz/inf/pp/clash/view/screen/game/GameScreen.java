package it.unibz.inf.pp.clash.view.screen.game;

import com.badlogic.gdx.Screen;
import com.badlogic.gdx.scenes.scene2d.ui.Label;
import com.badlogic.gdx.scenes.scene2d.ui.Table;
import it.unibz.inf.pp.clash.model.EventHandler;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;
import it.unibz.inf.pp.clash.view.screen.AbstractScreen;
import it.unibz.inf.pp.clash.view.screen.sync.AnimationCounter;

import java.util.concurrent.LinkedBlockingQueue;

public class GameScreen extends AbstractScreen implements Screen {

    private Snapshot currentSnapshot;
    private final GameCompositor gameCompositor;
    private final AnimationCounter animationCounter;
    private final LinkedBlockingQueue<Instruction> queue = new LinkedBlockingQueue<>();

    // This is the Libgdx "actor" that contains the message displayed on the game screen (right of the board).
    // With this reference, the message can be updated without redrawing the whole board.
    private Label displayedMessage;

    public GameScreen(EventHandler eventHandler, float animationDuration, boolean debug) {
        super(debug);
        this.animationCounter = new AnimationCounter(animationDuration);
        this.gameCompositor = new GameCompositor(eventHandler, animationCounter, debug);
    }

    public void updateMessage(String message) {
        enqueue(message);
    }

    public void drawSnapshot(Snapshot newSnapshot, String message) {
        enqueue(newSnapshot, message);
    }

    @Override
    public void render(float delta) {
        // if there is something to draw in the queue and no ongoing animation
        if (!queue.isEmpty() && animationCounter.isZero()) {
                executeNextInstruction();
        } else {
            renderCurrentSnapshot(delta);
        }
    }

    private void renderCurrentSnapshot(float delta) {
        // if there is no ongoing animation
        if (animationCounter.isZero()) {
            disableContinuousRendering();
        }
        super.render(delta);
    }

    // This method should only be called if there is an instruction in the queue and no ongoing animation.
    private void executeNextInstruction() {
            Instruction instruction = dequeue();
            enableContinuousRendering();
            // If the instruction only updates the displayed message
            if (instruction.snapshot() == null) {
                displayedMessage.setText(instruction.message());
            // If a new snapshot should be drawn
            } else {
                Snapshot newSnapshot = instruction.snapshot;
                stage.clear();
                Table mainTable = gameCompositor.createMainTable();
                stage.addActor(mainTable);
                displayedMessage = gameCompositor.drawGame(
                        currentSnapshot,
                        newSnapshot,
                        instruction.message,
                        mainTable
                );
                currentSnapshot = newSnapshot;
            }
        }

    private Instruction dequeue() {
        try {
            return queue.take();
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    private void enqueue(Snapshot snapshot, String message) {

        try {
            queue.put(new Instruction(snapshot, message));
        } catch (InterruptedException e) {
            throw new RuntimeException(e);
        }
    }

    private void enqueue(String message) {
        enqueue(null, message);
    }

    private record Instruction (Snapshot snapshot, String message) {}
}
