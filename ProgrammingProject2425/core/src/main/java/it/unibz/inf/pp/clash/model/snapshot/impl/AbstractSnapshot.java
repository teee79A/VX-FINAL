package it.unibz.inf.pp.clash.model.snapshot.impl;

import it.unibz.inf.pp.clash.model.bot.BotPlayer;
import it.unibz.inf.pp.clash.model.snapshot.Board;
import it.unibz.inf.pp.clash.model.snapshot.Hero;
import it.unibz.inf.pp.clash.model.snapshot.NormalizedBoard;
import it.unibz.inf.pp.clash.model.snapshot.Snapshot;

import java.util.Optional;

import static it.unibz.inf.pp.clash.model.snapshot.Board.TileCoordinates;

public abstract class AbstractSnapshot implements Snapshot {

    protected final Board board;
    protected final NormalizedBoard normalizedBoardP1, normalizedBoardP2;
    private final Hero firstHero;
    private final Hero secondHero;
    private final Optional<BotPlayer> firstBotPlayer;
    private final Optional<BotPlayer> secondBotPlayer;

    protected Player activeplayer;
    protected int actionsRemaining;
    protected TileCoordinates ongoingMove;


    protected AbstractSnapshot(Hero firstHero, Hero secondHero, Board board, Player activeplayer, int actionsRemaining,
                               TileCoordinates ongoingMove) {
        this.board = board;
        this.firstHero = firstHero;
        this.secondHero = secondHero;
        this.activeplayer = activeplayer;
        this.actionsRemaining = actionsRemaining;
        normalizedBoardP1 = NormalizedBoardImpl.createNormalizedBoard(board, Player.FIRST);
        normalizedBoardP2 = NormalizedBoardImpl.createNormalizedBoard(board, Player.SECOND);
        this.ongoingMove = ongoingMove;

        if (firstHero.isBot()) {
            firstBotPlayer = Optional.of(BotPlayer.getBotPlayerFromName(firstHero.getName()));
        } else {
            firstBotPlayer = Optional.empty();
        }

        if (secondHero.isBot()) {
            secondBotPlayer = Optional.of(BotPlayer.getBotPlayerFromName(secondHero.getName()));
        } else {
            secondBotPlayer = Optional.empty();
        }
    }


    @Override
    public NormalizedBoard getNormalizedBoard(Player player) {
        return switch (player) {
            case FIRST -> normalizedBoardP1;
            case SECOND -> normalizedBoardP2;
        };
    }


    @Override
    public NormalizedBoard getCurrentBoard() {
        return switch (activeplayer) {
            case FIRST -> normalizedBoardP1;
            case SECOND -> normalizedBoardP2;
        };
    }

    @Override
    public NormalizedBoard getNonCurrentBoard() {
        return switch (activeplayer) {
            case FIRST -> normalizedBoardP2;
            case SECOND -> normalizedBoardP1;
        };
    }

    public Board getBoard() {
        return board;
    }

    @Override
    public Hero getHero(Player player) {
        return switch (player) {
            case FIRST -> firstHero;
            case SECOND -> secondHero;
        };
    }

    @Override
    public Player getActivePlayer() {
        return activeplayer;
    }

    @Override
    public Player getNonActivePlayer() {
        return activeplayer == Player.FIRST ? Player.SECOND : Player.FIRST;
    }

    @Override
    public Optional<TileCoordinates> getOngoingMove() {
        return Optional.ofNullable(ongoingMove);
    }

    @Override
    public int getNumberOfRemainingActions() {
        return actionsRemaining;
    }


    @Override
    public void setActivePlayer(Player player) {
        activeplayer = player;
    }


    public Optional<BotPlayer> getFirstBotPlayer() {
        return firstBotPlayer;
    }

    public Optional<BotPlayer> getSecondBotPlayer() {
        return secondBotPlayer;
    }
}
