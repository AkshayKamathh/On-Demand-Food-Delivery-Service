import React from "react";

interface Params {
	params: { id: string };
}

export default function ProductPage({ params }: Params) {
	return (
		<div className="max-w-4xl mx-auto py-12">
			<h1 className="text-2xl font-semibold">Product {params.id}</h1>
			<p className="text-gray-600">Product details placeholder.</p>
		</div>
	);
}
