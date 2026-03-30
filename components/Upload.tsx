import {
	PROGRESS_INCREMENT,
	PROGRESS_INTERVAL_MS,
	REDIRECT_DELAY_MS,
} from "lib/constants";
import { CheckCircle2, ImageIcon, UploadIcon } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { useOutletContext } from "react-router";

interface UploadProps {
	onComplete?: (base64Data: string) => Promise<boolean | void>;
}

const Upload = ({ onComplete }: UploadProps) => {
	const [file, setFile] = useState<File | null>(null);
	const [isDragging, setIsDragging] = useState(false);
	const [progress, setProgress] = useState(0);
	const [error, setError] = useState<string | null>(null);
	const intervalRef = useRef<NodeJS.Timeout | null>(null);
	const timeoutRef = useRef<NodeJS.Timeout | null>(null);

	const { isSignedIn } = useOutletContext<AuthContext>();

	const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB
	const ALLOWED_TYPES = ["image/jpeg", "image/png", "image/webp"];

	const validateFile = useCallback((file: File): string | null => {
		if (!ALLOWED_TYPES.includes(file.type)) {
			return "Please upload a JPG, PNG, or WebP image.";
		}
		if (file.size > MAX_FILE_SIZE) {
			return "File size must be under 50MB.";
		}
		return null;
	}, []);

	useEffect(() => {
		return () => {
			if (intervalRef.current) {
				clearInterval(intervalRef.current);
				intervalRef.current = null;
			}
			if (timeoutRef.current) {
				clearTimeout(timeoutRef.current);
				timeoutRef.current = null;
			}
		};
	}, []);

	const processFile = useCallback(
		async (file: File) => {
			if (!isSignedIn) return;

			setFile(file);
			setProgress(0);

			const reader = new FileReader();
			reader.onerror = () => {
				setFile(null);
				setProgress(0);
			};
			reader.onload = async () => {
				const base64Data = reader.result as string;

				intervalRef.current = setInterval(() => {
					setProgress((prev) => {
						const next = prev + PROGRESS_INCREMENT;
						if (next >= 100) {
							if (intervalRef.current) {
								clearInterval(intervalRef.current);
								intervalRef.current = null;
							}
							timeoutRef.current = setTimeout(async () => {
								const result = await onComplete?.(base64Data);
								if (result === false) {
									// Reset state on failure - don't show redirect
									setFile(null);
									setProgress(0);
								} else if (result !== undefined) {
									// Only clear timeout if not showing success
									timeoutRef.current = null;
								}
							}, REDIRECT_DELAY_MS);
							return 100;
						}
						return next;
					});
				}, PROGRESS_INTERVAL_MS);
			};
			reader.readAsDataURL(file);
		},
		[isSignedIn, onComplete],
	);

	const handleDragOver = (e: React.DragEvent) => {
		e.preventDefault();
		if (!isSignedIn) return;
		setIsDragging(true);
		setError(null);
	};

	const handleDragLeave = () => {
		setIsDragging(false);
	};

	const handleDrop = (e: React.DragEvent) => {
		e.preventDefault();
		setIsDragging(false);
		setError(null);

		if (!isSignedIn) return;

		const droppedFile = e.dataTransfer.files[0];
		if (!droppedFile) return;

		const validationError = validateFile(droppedFile);
		if (validationError) {
			setError(validationError);
			return;
		}

		processFile(droppedFile);
	};

	const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
		setError(null);
		if (!isSignedIn) return;

		const selectedFile = e.target.files?.[0];
		if (!selectedFile) return;

		const validationError = validateFile(selectedFile);
		if (validationError) {
			setError(validationError);
			return;
		}

		processFile(selectedFile);
	};

	return (
		<div className="upload">
			{!file ? (
				<div
					className={`dropzone ${isDragging ? "is-dragging" : ""}`}
					onDragOver={handleDragOver}
					onDragLeave={handleDragLeave}
					onDrop={handleDrop}
				>
					<input
						type="file"
						className="drop-input"
						accept=".jpg,.jpeg,.png,.webp"
						disabled={!isSignedIn}
						onChange={handleChange}
					/>

					<div className="drop-content">
						<div className="drop-icon">
							<UploadIcon size={20} />
						</div>
						<p>
							{isSignedIn
								? "Click to upload or just drag and drop"
								: "Sign in or sign up with Puter to upload"}
						</p>
						<p className="help">Maximum file size is 50MB</p>

					{error && (
						<p className="upload-error">{error}</p>
					)}
					</div>
				</div>
			) : (
				<div className="upload-status">
					<div className="status-content">
						<div className="status-icon">
							{progress === 100 ? (
								<CheckCircle2 className="check" />
							) : (
								<ImageIcon className="image" />
							)}
						</div>

						<h3>{file.name}</h3>

						<div className="progress">
							<div
								className="bar"
								style={{ width: `${progress}%` }}
							/>

							<p className="status-text">
								{progress < 100
									? "Analyzing Floor Plan..."
									: "Redirecting..."}
							</p>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Upload;
