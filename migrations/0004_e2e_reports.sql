-- End-to-end encryption: what a reporter chose to reveal for review.
ALTER TABLE reports ADD COLUMN file_key TEXT;  -- key of just the reported file
ALTER TABLE reports ADD COLUMN plain TEXT;     -- decrypted text / file details from the reporter's device
