# Programming Project 2024/2025

## University of Bozen-Bolzano, Faculty of Computer Science

### Members of the group:

Daniel Lauri ([syntaxerror9](https://github.com/syntaxerror-9)), Lorenzo
Banino ([LorenzoB87](https://github.com/LorenzoB87)), Arshad Qureshi
([arshad-spec](https://github.com/arshad-spec))

### Building and running the project

First, create the gradle wrapper by running `gradle wrapper` in the root folder.

Then,
For Windows

```
./gradlew.bat run
```

for Linux/Macos

```
./gradlew run
```

Note: if you want to play the game with the Bot(LLM) that uses the external Groq api, you'll need to have the
environment
variable `GROQ_API_KEY` set to your Groq API key.

### Description

This project is based on the game mechanics
of [Might & Magic: Clash of Heroes](https://en.wikipedia.org/wiki/Might_&_Magic:_Clash_of_Heroes).

It is a turn-based strategy game where the player controls a side of the board, the player can perform the following
moves:

* Move a unit from one column to another column
* Delete a unit
* Call reinforcements
* Skip the turn

Each player has its own resources (such as HP, turns left, reinforcements count) and the objective of each player is to
bring the opponent's hp below or equal to zero.

Each player can create attacking and defensive formations like in the base game, and each unit has different attack
values, hp and attack cooldowns.

Additionally, the game supports playing vs bots, which can be chosen when selecting the player. There are two possible
bot opponents:

* Bot - Which is a programmed bot that is written as code (ProceduralBot)
* Bot(LLM) - Which is a bot that gets controlled by an external LLM using Groq api

### Implementation of the project

All of the game mechanics are implemented through the `GameEventHandler`, which acts as an entry point for all of the
actions a player can take.

Furthermore we've introduced the interface `NormalizedBoard`, which uses composition to abstract the base `Board
` implementation, and provides a more convenient way to reason about each of the player's board.
( For example, it provides board independent coordinates, and a way to never represent invalid states of the board by
representing each column as a stack ). All of the operations that modify the state of the board are done through the
NormalizedBoard, which are then _applied_ to the actual Board. This also allows playing with different sizes of boards, 
it would simply be a matter of changing values in the newGame default parameters.

The Bot players use the `BotPlayer` interface, which is implemented by the `ProceduralBot` and `LLMBot` classes.
In order to not make the game freeze ( since rendering happens on the same thread as the game logic ), the bot's actions
are executed in a separate thread, which is started whenever the bot is playing a turn.

Additional dependencies used in the project:

* Mockito
    * We've used Mockito to mock the `DisplayManager` in order to create more thorough tests that could mimic the way a
      player would play the game. We've also added some CI script such that tests run on every commit and pull request.

Programming techniques applied during the project: streams, composition, inheritance, unit tests, threads ...

### Description of the human experience in this project

The workload was initially divided evenly between the three members of the group, we've created a shared board where
each member could choose what to implement from the base game [link](https://github.com/users/syntaxerror-9/projects/4)

However, the work was done by Daniel Lauri and Lorenzo Banino, who implemented all of the game mechanics.

Usage of git:

* Each member had their own branch which would get merged into the main branch after code review/merge conflict
  resolution
* Some commits are with temporary names because Daniel Lauri forgot to squash the commits before merging the branch

Challenges faced during the project:

* Daniel Lauri:
    * The main challenge was to create the right abstractions for the game mechanics, i also had most of the
      implementation of the NormalizedBoard, which was a bit tricky to get right.
     
* Lorenzo Banino:
    * The main challenge was to implement the logic for detecting and creating formations on the game board like walls,
      because for example: vertical attack formations were not being recognized when they were created after a wall due to
      the fact that detection relied on sequential comparisons. Finding a solution was hard, I had to swap to a sliding
      window approach to make it work.

    * Another issue I had was solving conflicts, being new to git and team-working on the same project presented me
      with some difficulties in understanding how to merge our branches at best, without damaging the code. 

