// ABOUTME: Validation logic for participant eligibility in different competition phases
// Ensures baseline authors can't inject bugs and bug authors can't fix their own bugs

import { ParticipantId } from 'domain/competition-event/participant-id';
import { GameState } from './game-state';
import { GameError } from './game-error';

export class ParticipantValidator {
  static validateBaselineAuthor(participant: ParticipantId, state: GameState): void {
    if (!state.baselineAuthor || participant.getValue() !== state.baselineAuthor.getValue()) {
      throw new GameError('Only baseline author can perform this action');
    }
  }

  static validateNotBaselineAuthor(participant: ParticipantId, state: GameState): void {
    if (state.baselineAuthor && participant.getValue() === state.baselineAuthor.getValue()) {
      throw new GameError('Baseline author cannot perform this action');
    }
  }

  static validateNotBugAuthor(participant: ParticipantId, state: GameState): void {
    if (state.bugAuthor && participant.getValue() === state.bugAuthor.getValue()) {
      throw new GameError('Bug author cannot fix their own bug');
    }
  }
}
