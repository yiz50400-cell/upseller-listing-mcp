import { hash as defaultHash } from './storage.js';

export function listingFingerprint(task, files, hashFn = defaultHash) {
  const { publish: _publish, ...rest } = task || {};
  return hashFn(JSON.stringify({
    ...rest,
    images: (files || []).map((file) => ({ hash: file.hash, role: file.role, skuName: file.skuName })),
    sourceFile: undefined,
  }));
}

export function isUnpublishedDraft(record) {
  const status = record?.state ?? record?.platformStatus;
  return status === 'draft';
}

export function isPublishedOrOnline(record) {
  const status = record?.state ?? record?.platformStatus;
  return status === 'online' || status === 'publishing' || status === 'published';
}

function sameDraftId(state, task, platform) {
  const fromTask = task?.draftId != null && String(task.draftId).trim() !== '' ? String(task.draftId) : '';
  const fromState = state?.draftId != null && String(state.draftId).trim() !== '' ? String(state.draftId) : '';
  const fromPlatform = String(platform?.idStr ?? platform?.id ?? '').trim();
  if (fromTask && fromState) return fromTask === fromState;
  if (fromState && fromPlatform) return fromState === fromPlatform;
  return false;
}

function lastSucceeded(state) {
  return state?.submission?.stage === 'verified' && Boolean((state.completedResult || state.lastResult)?.ok);
}

export function decideListingResume({ state, fingerprint, task, platform } = {}) {
  if (!state) return { type: 'continue' };

  const publish = task?.publish === true;
  const inFlight = state.submission?.stage === 'intent' || state.submission?.stage === 'accepted';
  const stillDraft = isUnpublishedDraft(platform);
  const sameDraft = sameDraftId(state, task, platform);

  if (isPublishedOrOnline(platform)) {
    return { type: 'already-completed' };
  }

  if (inFlight) return { type: 'resume' };

  const fingerprintChanged = state.fingerprint !== fingerprint;
  if (fingerprintChanged) {
    if (sameDraft && stillDraft) {
      return { type: 'continue', updateFingerprint: true, skipSubmissionShortCircuit: true };
    }
    return { type: 'mismatch' };
  }

  if (lastSucceeded(state) && stillDraft) {
    const lastPublished = state.completedResult?.publishRequested === true || state.submission?.op === '2';
    if (publish && !lastPublished) {
      return { type: 'continue', skipSubmissionShortCircuit: true };
    }
    if (!publish) {
      return { type: 'already-completed' };
    }
  }

  if (lastSucceeded(state) && !stillDraft) {
    return { type: 'already-completed' };
  }

  return { type: 'continue' };
}
